alter table public.inventory_reservations add column released_at timestamptz,
  add constraint reservation_closed_once check (released_at is null or consumed_at is null);
alter table public.orders add column inventory_review_required boolean not null default false;

-- User-scoped RPC: the actor comes from the verified session, never a request parameter.
create function public.release_order_reservations(p_order_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders; actor uuid:=auth.uid(); released_lines jsonb;
begin
  if actor is null or not shs_private.is_admin() then raise insufficient_privilege; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'A release reason is required'; end if;
  select * into strict o from public.orders where id=p_order_id for update;
  if o.payment_status not in ('pending','failed') then raise exception 'Paid stock cannot be released'; end if;
  perform 1 from public.product_variants v join public.inventory_reservations r on r.variant_id=v.id
    where r.order_id=o.id and r.consumed_at is null and r.released_at is null order by v.id for update of v;
  with released as (
    update public.inventory_reservations set released_at=now()
      where order_id=o.id and consumed_at is null and released_at is null returning variant_id,quantity
  ), adjusted as (
    update public.product_variants v set reserved_quantity=v.reserved_quantity-r.quantity
      from released r where v.id=r.variant_id returning r.variant_id,r.quantity
  )
  select jsonb_agg(jsonb_build_object('variantId',variant_id,'quantityReleased',quantity) order by variant_id)
    into released_lines from adjusted;
  if released_lines is null then return false; end if;
  perform public.write_audit_log(actor,'inventory.hold_released','order',o.order_number,p_reason,
    jsonb_build_object('lines',released_lines));
  return true;
end $$;
revoke all on function public.release_order_reservations(uuid,text) from public,anon,service_role;
grant execute on function public.release_order_reservations(uuid,text) to authenticated;

-- Lock pack rows in the same stable order as checkout. Count this order's outstanding holds
-- towards its available quantity, never another order's. A shortage leaves every pack untouched.
create function shs_private.consume_order_inventory(o uuid, event_id uuid, provider_event text)
returns boolean language plpgsql set search_path='' as $$
declare line record; used_hold boolean;
begin
  if exists(select 1 from public.inventory_payment_applications where order_id=o) then return true; end if;
  perform 1 from public.product_variants v join public.order_items i on i.product_variant_id=v.id
    where i.order_id=o order by v.id for update of v;
  if exists(select 1 from public.order_items i join public.product_variants v on v.id=i.product_variant_id
    left join public.inventory_reservations r on r.order_id=i.order_id and r.variant_id=v.id
    where i.order_id=o and ((r.variant_id is not null and not v.track_inventory) or (v.track_inventory and
      (v.stock_quantity is null or v.stock_quantity-v.reserved_quantity+
       case when r.consumed_at is null and r.released_at is null then coalesce(r.quantity,0) else 0 end < i.quantity)))) then
    return false;
  end if;
  for line in select v.id,v.stock_quantity,i.quantity from public.order_items i join public.product_variants v
    on v.id=i.product_variant_id where i.order_id=o and v.track_inventory order by v.id
  loop
    update public.inventory_reservations set consumed_at=now()
      where order_id=o and variant_id=line.id and consumed_at is null and released_at is null;
    used_hold:=found;
    update public.product_variants set stock_quantity=stock_quantity-line.quantity,
      reserved_quantity=reserved_quantity-case when used_hold then line.quantity else 0 end where id=line.id;
    insert into public.inventory_adjustments(product_variant_id,order_id,payment_event_id,before_quantity,
      adjustment_delta,after_quantity,reason) values(line.id,o,event_id,line.stock_quantity,
      -line.quantity,line.stock_quantity-line.quantity,'Verified payment inventory decrement');
  end loop;
  insert into public.inventory_payment_applications(order_id,provider_event_id) values(o,provider_event);
  return true;
end $$;
revoke all on function shs_private.consume_order_inventory(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.reconcile_captured_inventory(p_order_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders; actor uuid:=auth.uid(); capture public.payment_events;
begin
  if actor is null or not shs_private.is_admin() then raise insufficient_privilege; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>500 then raise exception 'A reconciliation reason is required'; end if;
  select * into strict o from public.orders where id=p_order_id for update;
  if not o.inventory_review_required then return false; end if;
  if o.payment_status<>'paid' or o.status<>'pending' or o.refunded_paise<>0 then
    raise exception 'Cancelled or refunded payment requires financial review'; end if;
  select * into strict capture from public.payment_events where order_id=o.id and resulting_status='paid'
    and signature_verified and capture_status='captured' and provider_payment_id=o.razorpay_payment_id
    order by created_at,id limit 1;
  if not shs_private.consume_order_inventory(o.id,capture.id,capture.provider_event_id) then
    raise exception 'Insufficient available packs' using errcode='SH002'; end if;
  update public.orders set inventory_review_required=false,status='confirmed' where id=o.id;
  insert into public.order_status_history(order_id,status,note,created_by) values(o.id,'confirmed','Payment inventory reconciled.',actor);
  perform public.write_audit_log(actor,'inventory.capture_reconciled','order',o.order_number,p_reason);
  return true;
end $$;
revoke all on function public.reconcile_captured_inventory(uuid,text) from public,anon,service_role;
grant execute on function public.reconcile_captured_inventory(uuid,text) to authenticated;

create or replace function public.apply_payment_event(
  p_order_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_target_status text,
  p_provider_payment_id text,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  inserted_event_id uuid;
  event_amount integer;
  event_currency text;
  refund_total integer;
  needs_review boolean;
begin
  if p_target_status not in ('paid', 'failed', 'refunded') then
    raise exception 'Unsupported payment status';
  end if;
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  event_amount := case
    when coalesce(p_payload ->> 'amount', '') ~ '^\d+$' then (p_payload ->> 'amount')::integer
    else null
  end;
  event_currency := nullif(p_payload ->> 'currency', '');

  -- The order lock serializes refund identity checks and state transitions.
  if p_target_status in ('paid', 'refunded') then
    if coalesce(p_payload ->> 'signatureVerified', '') <> 'true'
       or nullif(p_provider_payment_id, '') is null
       or event_currency is distinct from current_order.currency then
      raise exception 'Unverified payment event';
    end if;
    if current_order.razorpay_payment_id is not null
       and current_order.razorpay_payment_id is distinct from p_provider_payment_id then
      raise exception 'Payment does not match the recorded order payment';
    end if;
  end if;

  if p_target_status='failed' and (p_payload->>'signatureVerified' is distinct from 'true'
     or nullif(p_provider_payment_id,'') is null or event_currency is distinct from current_order.currency
     or event_amount is distinct from current_order.grand_total_paise) then
    raise exception 'Unverified failure event';
  end if;
  if p_target_status = 'refunded' then
    if nullif(p_payload ->> 'refundId', '') is null then
      raise exception 'Refund identity required';
    end if;
    if exists (select 1 from public.payment_events
      where order_id = p_order_id and provider_refund_id = p_payload ->> 'refundId') then
      if not exists(select 1 from public.payment_events where order_id=p_order_id
        and provider_refund_id=p_payload->>'refundId' and amount_paise=event_amount) then
        raise exception 'Conflicting refund amount'; end if;
      return false;
    end if;
  end if;

  insert into public.payment_events (
    order_id, provider_event_id, event_type, provider_payment_id, resulting_status,
    payload, amount_paise, currency, signature_verified, capture_status, provider_refund_id
  ) values (
    p_order_id, p_provider_event_id, p_event_type, nullif(p_provider_payment_id, ''),
    p_target_status::public.payment_status, coalesce(p_payload, '{}'::jsonb),
    event_amount, event_currency,
    case when p_payload ? 'signatureVerified' then (p_payload ->> 'signatureVerified')::boolean else null end,
    nullif(p_payload ->> 'captureStatus', ''), nullif(p_payload ->> 'refundId', '')
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;
  if inserted_event_id is null then
    if not exists(select 1 from public.payment_events where provider_event_id=p_provider_event_id
        and order_id=p_order_id and provider_payment_id=p_provider_payment_id and event_type=p_event_type
        and amount_paise=event_amount and currency=event_currency) then raise exception 'Conflicting event identity'; end if;
    return false;
  end if;

  if p_target_status = 'paid' then
    if p_payload->>'captureStatus' is distinct from 'captured' then raise exception 'Captured payment required'; end if;
    if event_amount is null or event_amount <> current_order.grand_total_paise or event_currency is distinct from current_order.currency then
      raise exception 'Payment amount or currency mismatch';
    end if;
    if current_order.payment_status = 'paid'
       and current_order.razorpay_payment_id is distinct from nullif(p_provider_payment_id, '') then
      raise exception 'Order already paid with a different payment';
    end if;

    -- A repeated capture must not reverse refunds or resend payment-success email.
    if current_order.payment_status in ('paid', 'refunded') then
      update public.payment_events set resulting_status = current_order.payment_status
      where id = inserted_event_id;
      return false;
    end if;

    -- Keep the verified financial result even when a previously released pack was sold elsewhere.
    needs_review := exists(select 1 from public.inventory_reservations where order_id=p_order_id and released_at is not null);
    if not needs_review then
      needs_review := not shs_private.consume_order_inventory(p_order_id,inserted_event_id,p_provider_event_id);
    end if;
    update public.orders
    set payment_status = 'paid',
        razorpay_payment_id = coalesce(razorpay_payment_id, nullif(p_provider_payment_id, '')),
        paid_at = coalesce(paid_at, now()),
        inventory_review_required = needs_review or current_order.status='cancelled',
        status = case when not needs_review and status = 'pending' then 'confirmed'::public.order_status else status end
    where id = p_order_id;
    if needs_review or current_order.status='cancelled' then
      perform public.write_audit_log(null,'inventory.capture_review','order',current_order.order_number,
        'Verified payment requires inventory or cancellation review');
    end if;
    if not needs_review and current_order.status = 'pending' then
      insert into public.order_status_history (order_id, status, note)
      values (p_order_id, 'confirmed', 'Payment confirmed.');
    end if;
  elsif p_target_status = 'failed' then
    if current_order.payment_status in ('paid', 'refunded', 'failed') then
      update public.payment_events set resulting_status = current_order.payment_status
      where id = inserted_event_id;
      return false;
    end if;
    update public.orders set payment_status = 'failed' where id = p_order_id;
  elsif p_target_status = 'refunded' then
    if current_order.payment_status not in ('paid', 'refunded') or event_amount is null or event_amount <= 0 then
      raise exception 'Invalid refund event';
    end if;
    refund_total := current_order.refunded_paise + event_amount;
    if refund_total > current_order.grand_total_paise then raise exception 'Refund exceeds payment'; end if;
    update public.orders
    set refunded_paise = refund_total,
        payment_status = case
          when refund_total = grand_total_paise then 'refunded'::public.payment_status
          else 'paid'::public.payment_status
        end
    where id = p_order_id;
    update public.payment_events
    set resulting_status = case
      when refund_total = current_order.grand_total_paise then 'refunded'::public.payment_status
      else 'paid'::public.payment_status
    end
    where id = inserted_event_id;
  end if;
  return true;
end;
$$;


revoke all on function public.apply_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid, text, text, text, text, jsonb) to service_role;

-- Prevent both stale initialization leases and post-release retries from opening another payment.
create or replace function public.claim_payment_initialization(p_order_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.orders o set payment_initialization_token=p_token,payment_initialization_started_at=now()
   where id=p_order_id and razorpay_order_id is null and status='pending' and payment_status in ('pending','failed')
     and not exists(select 1 from public.inventory_reservations where order_id=o.id and released_at is not null)
     and (payment_initialization_token is null or payment_initialization_started_at<now()-interval '2 minutes');
  return found;
end $$;
create or replace function public.finish_payment_initialization(p_order_id uuid,p_token uuid,p_provider_order_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.orders set razorpay_order_id=coalesce(nullif(p_provider_order_id,''),razorpay_order_id),
    payment_initialization_token=null,payment_initialization_started_at=null
    where id=p_order_id and payment_initialization_token=p_token and razorpay_order_id is null;
  return found;
end $$;

create function shs_private.check_fulfilment_review() returns trigger language plpgsql set search_path='' as $$
begin
  if new.inventory_review_required and new.status not in ('pending','cancelled') then
    raise exception 'Reconcile inventory before fulfilment'; end if;
  return new;
end $$;
create trigger check_fulfilment_review before update of status on public.orders
  for each row execute function shs_private.check_fulfilment_review();

create trigger immutable_order_pricing before update of subtotal_paise,shipping_paise,tax_paise,discount_paise,
  grand_total_paise,currency,pricing_snapshot,address_snapshot on public.orders
  for each row execute function public.reject_append_only_change();
create trigger immutable_order_lines before update of product_name,product_slug,variant_name,weight_grams,
  unit_price_paise,quantity,line_total_paise on public.order_items for each row execute function public.reject_append_only_change();

create or replace function public.admin_update_order_fulfillment(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_status text,
  p_tracking_number text,
  p_courier text,
  p_tracking_url text,
  p_customer_note text,
  p_internal_note text,
  p_shipping_date timestamptz,
  p_correlation_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  changed_status boolean;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled') then
    raise exception 'Invalid order status';
  end if;
  if nullif(p_tracking_url, '') is not null and p_tracking_url !~ '^https?://' then
    raise exception 'Invalid tracking URL';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  changed_status := current_order.status::text <> p_status;

  if changed_status and not (
    (current_order.status::text = 'pending' and p_status = 'cancelled') or
    (current_order.status::text = 'confirmed' and p_status in ('processing', 'cancelled')) or
    (current_order.status::text = 'processing' and p_status in ('packed', 'cancelled')) or
    (current_order.status::text = 'packed' and p_status in ('shipped', 'cancelled')) or
    (current_order.status::text = 'shipped' and p_status = 'out_for_delivery') or
    (current_order.status::text = 'out_for_delivery' and p_status = 'delivered')
  ) then
    raise exception 'Invalid fulfilment transition';
  end if;

  if p_status in ('confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered')
     and current_order.payment_status <> 'paid' then
    raise exception 'Paid order required';
  end if;

  if not changed_status
     and current_order.tracking_number is not distinct from nullif(trim(p_tracking_number),'')
     and current_order.courier is not distinct from nullif(trim(p_courier),'')
     and current_order.tracking_url is not distinct from nullif(trim(p_tracking_url),'')
     and current_order.shipping_note is not distinct from nullif(trim(p_customer_note),'')
     and current_order.internal_note is not distinct from nullif(trim(p_internal_note),'')
     and (p_status not in ('shipped','out_for_delivery','delivered') or current_order.shipped_at is not null)
     then return false;
  end if;

  update public.orders
  set status = p_status::public.order_status,
      tracking_number = nullif(trim(p_tracking_number), ''),
      courier = nullif(trim(p_courier), ''),
      tracking_url = nullif(trim(p_tracking_url), ''),
      shipping_note = nullif(trim(p_customer_note), ''),
      internal_note = nullif(trim(p_internal_note), ''),
      shipped_at = case
        when p_status in ('shipped', 'out_for_delivery', 'delivered') then coalesce(shipped_at, p_shipping_date, now())
        else shipped_at
      end,
      delivered_at = case when p_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_order_id;

  if changed_status then
    insert into public.order_status_history (order_id, status, note, created_by)
    values (p_order_id, p_status::public.order_status, nullif(trim(p_customer_note), ''), p_admin_user_id);
  end if;

  perform public.write_audit_log(
    p_admin_user_id,
    case when changed_status then 'order.fulfilment_changed' else 'order.tracking_updated' end,
    'order', current_order.order_number,
    case when changed_status
      then 'Order fulfilment changed from ' || current_order.status::text || ' to ' || p_status || '.'
      else 'Order tracking details updated.'
    end,
    jsonb_build_object(
      'fromStatus', current_order.status::text,
      'toStatus', p_status,
      'hasTrackingNumber', nullif(trim(p_tracking_number), '') is not null,
      'courier', nullif(trim(p_courier), '')
    ),
    p_correlation_id
  );
  return true;
end;
$$;
