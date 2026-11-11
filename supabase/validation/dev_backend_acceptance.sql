-- Run against the dedicated development project only. No fixtures survive this transaction.
begin;
-- The in-memory test harness supplies its own isolated owner. Hosted runs never
-- manufacture administrators or act as the permanent operator.
create temporary table personas as select gen_random_uuid() a,gen_random_uuid() b,
 nullif(current_setting('shs_test.ephemeral_owner',true),'')::uuid admin,gen_random_uuid() import_id;
grant select on personas to authenticated,anon;
insert into auth.users(id,email,raw_user_meta_data)
select id,id::text||'@example.invalid','{"role":"admin"}'::jsonb from personas cross join lateral unnest(array[a,b]) id;
insert into public.addresses(user_id,recipient_name,phone,address_line_1,city,state,postal_code)
select id,'Fixture','9000000000','Fixture street','Chennai','TN','600001' from personas cross join lateral unnest(array[a,b]) id;
do $$ begin
  begin
    update public.profiles set role='admin' where id=(select a from personas);
    raise exception 'Non-owner role assignment unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select a::text from personas),true);
do $$
declare lines jsonb:='[{"productSlug":"rasam-podi","weightGrams":100,"quantity":2}]'; result jsonb;
begin
 if (select count(*) from public.profiles)<>1 or (select count(*) from public.addresses)<>1 or shs_private.is_admin() then raise exception 'Customer read isolation or role boundary failed'; end if;
 update public.addresses set city='Forbidden' where user_id=(select b from personas);
 if found then raise exception 'Cross-owner update allowed'; end if;
 if has_column_privilege(current_user,'public.profiles','role','UPDATE') or has_column_privilege(current_user,'public.orders','grand_total_paise','UPDATE') then raise exception 'Privilege escalation possible'; end if;
 perform public.my_cart('merge',lines,(select import_id from personas));
 result:=public.my_cart('merge',lines,(select import_id from personas));
 if (result->0->>'quantity')::integer<>2 then raise exception 'Guest import duplicated'; end if;
 perform public.my_cart('add',lines);
 result:=public.my_cart('load');
 if (result->0->>'quantity')::integer<>4 then raise exception 'Cart persistence failed'; end if;
 perform set_config('request.jwt.claim.sub',(select b::text from personas),true);
 if public.my_cart('load') <> '[]'::jsonb or exists(select 1 from public.cart_items) then raise exception 'Cross-owner cart leak'; end if;
 if has_function_privilege(current_user,'public.admin_create_product(uuid,text,text,text,integer[])','execute') then raise exception 'Customer can create products'; end if;
end $$;
reset role;
do $$
declare staff uuid:=(select admin from personas); fixture uuid; pack uuid; oid uuid; snap jsonb; order_key uuid:=gen_random_uuid(); media public.product_images;
begin
 if staff is null then return; end if;
 -- Draft catalogue, role checks and audit entries, without publishing extra catalogue items.
 begin
   perform public.admin_create_product((select a from personas),'shs-dev-fixture','Fixture','Instant Mix',array[100,200,300,400]);
   raise exception 'Unexpected success' using errcode='SH099';
 exception when raise_exception then if sqlerrm<>'Admin required' then raise; end if; end;
 fixture:=public.admin_create_product(staff,'shs-dev-fixture','Fixture','Instant Mix',array[100,200,300,400]);
 select * into media from public.product_images limit 1;
 if found then
   if public.admin_set_product_image(staff,media.product_id,null) is distinct from media.object_name then raise exception 'Incorrect displaced object'; end if;
   perform public.admin_set_product_image(staff,media.product_id,media.object_name);
   if not exists(select 1 from public.product_images where product_id=media.product_id and object_name=media.object_name) then raise exception 'Image replacement failed'; end if;
 end if;
 if (select count(*) from public.product_variants where product_id=fixture)<>4 or not exists(select 1 from public.audit_logs where entity_id=fixture::text) then raise exception 'Draft or audit incomplete'; end if;
 select id into pack from public.product_variants where product_id=fixture and weight_grams=100;
 perform public.admin_update_variant(pack,staff,100,100,true,true,1,'Synthetic acceptance stock',null);
 update public.products set active=true where id=fixture;
 snap:=jsonb_build_array(jsonb_build_object('product_id',fixture,'product_variant_id',pack,'product_name','Fixture','product_slug','shs-dev-fixture','variant_name','100 g','weight_grams',100,'unit_price_paise',100,'quantity',1));
 update public.store_settings set checkout_enabled=false where settings_key='default';
 begin
   perform public.create_pending_order('SHS-20261110-QAAB26',null,'a@example.invalid','9000000000','Fixture','{"postalCode":"600001"}',null,100,0,gen_random_uuid(),snap);
   raise exception 'Disabled checkout accepted';
 exception when sqlstate 'SH003' then null; end;
 update public.store_settings set shipping_coverage='pan_india_serviceable',serviceable_postal_codes=array['600001'], tax_mode='none',discount_mode='none',order_email_hook_enabled=true,policies_approved=true,checkout_enabled=true,flat_shipping_paise=0 where settings_key='default';
 begin
   perform public.create_pending_order('SHS-20261110-QAAB26',null,'a@example.invalid','9000000000','Fixture','{"postalCode":"600001"}',null,1,0,gen_random_uuid(),snap);
   raise exception 'Incorrect order subtotal accepted';
 exception when sqlstate 'SH004' then null; end;
 oid:=public.create_pending_order('SHS-20261110-QAAB23',(select a from personas),'a@example.invalid','9000000000','Fixture','{"postalCode":"600001"}',null,100,0,order_key,snap);
 begin
   perform public.create_pending_order('SHS-20261110-QAAB24',null,'b@example.invalid','9000000000','Fixture','{"postalCode":"600001"}',null,100,0,gen_random_uuid(),snap);
   raise exception 'Last pack oversold';
 exception when sqlstate 'SH002' then null; end;
 begin
   perform public.create_pending_order('SHS-20261110-QAAB25',null,'b@example.invalid','9000000000','Fixture','{"postalCode":"600001"}',null,100,0,order_key,snap);
   raise exception 'Duplicate order accepted';
 exception when unique_violation then null; end;
 if (select count(*) from public.orders where order_number like 'SHS-20261110-QAAB%')<>1 then raise exception 'Partial orders survived'; end if;
 perform public.apply_payment_event(oid,'fixture-capture','test.capture','paid','pay_fixture','{"amount":100,"currency":"INR","captureStatus":"captured","signatureVerified":true}');
 if (select stock_quantity+reserved_quantity from public.product_variants where id=pack)<>0 then raise exception 'Capture inventory mismatch'; end if;
 if (select count(*) from public.notification_outbox where order_id=oid)<>2 then raise exception 'Order and payment events not queued'; end if;
 if (select count(*) from public.claim_order_notice('SHS-20261110-QAAB23','payment_success'))<>1 or
    (select count(*) from public.claim_order_notice('SHS-20261110-QAAB23','payment_success'))<>0 then raise exception 'Notification claim not exclusive'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select b::text from personas),true);
do $$ begin if exists(select 1 from public.orders) or exists(select 1 from public.order_items) then raise exception 'Order IDOR'; end if; end $$;
reset role;
set local role anon;
do $$ begin
 if has_table_privilege(current_user,'public.profiles','select') or has_table_privilege(current_user,'public.cart_items','select') then raise exception 'Anonymous private data'; end if;
 if has_function_privilege(current_user,'public.my_cart(text,jsonb,uuid)','execute') then raise exception 'Anonymous cart mutation'; end if;
end $$;
rollback;
