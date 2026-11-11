-- Disposable database only. All pricing, stock, orders and events roll back.
begin;
create temp table sprint5_pack as select v.id,v.product_id from public.product_variants v
  join public.products p on p.id=v.product_id where p.slug='rasam-podi' and v.weight_grams=100;
create function pg_temp.fixture_order(number text,pin text,subtotal integer,shipping integer,tax integer,discount integer)
returns uuid language sql as $$
  select public.create_pending_order(number,null,'qa@example.invalid','9000000000','Fixture',
    jsonb_build_object('postalCode',pin),null,subtotal,shipping,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id',product_id,'product_variant_id',id,'weight_grams',100,
      'unit_price_paise',subtotal,'quantity',1)),tax,discount) from sprint5_pack;
$$;
do $$
declare actor uuid:=current_setting('shs_test.ephemeral_owner')::uuid; o uuid; other_order uuid; pack uuid:=(select id from sprint5_pack);
  price integer; fee integer; n integer; histories integer; changes integer;
  capture jsonb:='{"amount":200808,"currency":"INR","captureStatus":"captured","signatureVerified":true}';
begin
  if (select free_shipping_threshold_paise from public.store_settings where settings_key='default')<>200000 then raise exception 'Approved threshold missing'; end if;
  if exists(select 1 from public.store_settings where checkout_enabled) then raise exception 'Checkout must start disabled'; end if;
  begin
    update public.store_settings set flat_shipping_paise=801,policies_approved=true,checkout_enabled=true where settings_key='default';
    raise exception 'Incomplete rules activated';
  exception when check_violation then null; end;
  foreach n in array array[1,2,3] loop
    begin
      if n=1 then perform public.release_order_reservations(gen_random_uuid(),'denied');
      elsif n=2 then perform public.reconcile_captured_inventory(gen_random_uuid(),'denied');
      else perform public.configure_checkout_pricing('pan_india_serviceable',array['600001'],801,200000,'none',null,null,'none'); end if;
      raise exception 'Unauthorized operation succeeded';
    exception when insufficient_privilege then null; end;
  end loop;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.configure_checkout_pricing('pan_india_serviceable',array['600001'],801,200000,'exclusive_order_half_up',100,true,'none');
  update public.store_settings set policies_approved=true,checkout_enabled=true where settings_key='default';
  update public.product_variants set price_paise=50,track_inventory=true,stock_quantity=1 where id=pack;
  begin perform pg_temp.fixture_order('SHS-20261111-QQAB23','600002',50,801,9,0);raise exception 'Unserved PIN accepted';
  exception when sqlstate 'SH004' then null;end;
  begin perform pg_temp.fixture_order('SHS-20261111-QQAB23','600001',50,801,8,0);raise exception 'Incorrect tax accepted';
  exception when sqlstate 'SH004' then null;end;
  begin perform pg_temp.fixture_order('SHS-20261111-QQAB23','600001',50,801,9,1);raise exception 'Unauthorized discount accepted';
  exception when sqlstate 'SH004' then null;end;
  begin perform pg_temp.fixture_order('SHS-20261111-QQAB23','600001',51,801,9,0);raise exception 'Stale price accepted';
  exception when sqlstate 'SH001' then null;end;
  o:=pg_temp.fixture_order('SHS-20261111-QQAB23','600001',50,801,9,0);
  if not exists(select 1 from public.orders where id=o and grand_total_paise=860 and currency='INR'
    and tax_paise=9 and discount_paise=0 and pricing_snapshot->>'taxMode'='exclusive_order_half_up') then raise exception 'Invalid snapshot';end if;
  begin update public.orders set tax_paise=8 where id=o;raise exception 'Snapshot overwritten';
  exception when raise_exception then if sqlerrm not like '%append-only%' then raise;end if;end;
  begin perform public.admin_adjust_inventory(pack,actor,-1,'under existing hold',null);raise exception 'Stock fell below hold';
  exception when check_violation then null;end;
  if public.admin_update_order_fulfillment(o,actor,'pending',null,null,null,null,null,null) then raise exception 'Repeated admin update';end if;
  begin perform public.admin_update_order_fulfillment(o,actor,'packed',null,null,null,null,null,null);raise exception 'Invalid transition succeeded';
  exception when raise_exception then if sqlerrm<>'Invalid fulfilment transition' then raise;end if;end;
  perform public.apply_payment_event(o,'fixture-failed','payment.failed','failed','pay_fixture','{"signatureVerified":true,"amount":860,"currency":"INR"}');
  if (select reserved_quantity from public.product_variants where id=pack)<>1 then raise exception 'Failure released stock';end if;
  perform public.admin_update_order_fulfillment(o,actor,'cancelled',null,null,null,null,null,null);
  if (select reserved_quantity from public.product_variants where id=pack)<>1 then raise exception 'Cancellation released stock';end if;
  if not public.release_order_reservations(o,'Fixture manual release') or public.release_order_reservations(o,'Replay') then raise exception 'Release not idempotent';end if;
  if public.claim_payment_initialization(o,gen_random_uuid()) then raise exception 'Released order initialized';end if;
  update public.store_settings set checkout_enabled=false;
  perform public.configure_checkout_pricing('pan_india_serviceable',array['600001'],801,200000,'none',null,null,'none');
  update public.store_settings set checkout_enabled=true;
  update public.product_variants set price_paise=200000 where id=pack;
  other_order:=pg_temp.fixture_order('SHS-20261111-QQAB24','600001',200000,801,0,0);
  capture:=capture||'{"amount":860}';
  perform public.apply_payment_event(o,'fixture-late','payment.captured','paid','pay_late',capture);
  if not exists(select 1 from public.orders where id=o and status='cancelled' and payment_status='paid' and inventory_review_required)
    or (select reserved_quantity from public.product_variants where id=pack)<>1 then raise exception 'Late capture lost or stole a hold';end if;
  if public.apply_payment_event(o,'fixture-late','payment.captured','paid','pay_late',capture) then raise exception 'Duplicate capture';end if;
  perform public.apply_payment_event(o,'fixture-partial','refund.processed','refunded','pay_late',capture||'{"refundId":"refund_a","amount":60}');
  perform public.apply_payment_event(o,'fixture-full','refund.processed','refunded','pay_late',capture||'{"refundId":"refund_b","amount":800}');
  if (select stock_quantity from public.product_variants where id=pack)<>1 then raise exception 'Refund altered stock';end if;
  -- Dedicated review path for a late paid order that has not been cancelled or refunded.
  perform public.release_order_reservations(other_order,'Fixture release');
  update public.product_variants set stock_quantity=0 where id=pack;
  perform public.apply_payment_event(other_order,'fixture-late-pending','payment.captured','paid','pay_pending',capture||'{"amount":200801}');
  begin perform public.reconcile_captured_inventory(other_order,'Fixture review');raise exception 'Missing stock accepted';
  exception when sqlstate 'SH002' then null;end;
  perform public.admin_adjust_inventory(pack,actor,1,'Fixture stock count',null);
  if not public.reconcile_captured_inventory(other_order,'Fixture approved allocation')
    or public.reconcile_captured_inventory(other_order,'Replay') then raise exception 'Review not idempotent'; end if;
  if not exists(select 1 from public.orders where id=other_order and status='confirmed' and not inventory_review_required)
    or (select stock_quantity from public.product_variants where id=pack)<>0 then raise exception 'Reconciliation failed';end if;
  perform public.admin_update_order_fulfillment(other_order,actor,'processing',null,null,null,null,null,null);
  select count(*) into histories from public.order_status_history where order_id=other_order;
  select count(*) into changes from public.audit_logs where entity_id='SHS-20261111-QQAB24';
  perform public.admin_update_order_fulfillment(other_order,actor,'processing',null,null,null,null,null,null);
  if histories<>(select count(*) from public.order_status_history where order_id=other_order)
    or changes<>(select count(*) from public.audit_logs where entity_id='SHS-20261111-QQAB24') then raise exception 'Duplicate admin history';end if;
  if not exists(select 1 from public.audit_logs where actor_user_id=actor and event_type='inventory.hold_released'
    and metadata->'lines' @> jsonb_build_array(jsonb_build_object('variantId',pack,'quantityReleased',1))) then raise exception 'Missing release audit';end if;
  foreach price in array array[199999,200000,200001] loop
    update public.product_variants set price_paise=price,stock_quantity=1 where id=pack;
    fee:=case when price>200000 then 0 else 801 end;
    o:=pg_temp.fixture_order('SHS-20261111-QAAB'||(price-199977)::text,'600001',price,fee,0,0);
    perform public.release_order_reservations(o,'Boundary fixture');
  end loop;
end $$;
rollback;
