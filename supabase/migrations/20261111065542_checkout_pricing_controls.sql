-- A NULL choice means that the merchant has not approved this rule.
alter table public.store_settings
  add column shipping_coverage text check (shipping_coverage='pan_india_serviceable'),
  add column dispatch_origin text,
  add column enquiry_email text,
  add column instagram_url text check (instagram_url is null or instagram_url like 'https://www.instagram.com/%'),
  add column gstin text check (gstin is null or length(gstin) between 1 and 40),
  add column fssai_license_number text check (fssai_license_number is null or length(fssai_license_number) between 1 and 40),
  add column tax_mode text check (tax_mode in ('none','exclusive_order_half_up')),
  add column tax_rate_bps integer check (tax_rate_bps between 0 and 10000),
  add column tax_shipping boolean,
  add column discount_mode text check (discount_mode = 'none'),
  add constraint checkout_requires_pricing_choices check (not checkout_enabled or (
    shipping_coverage is not null and discount_mode is not null and tax_mode is not null
    and coalesce(cardinality(serviceable_postal_codes),0)>0
    and array_to_string(serviceable_postal_codes,',','!') ~ '^[1-9][0-9]{5}(,[1-9][0-9]{5})*$'
    and ((tax_mode='none' and tax_rate_bps is null and tax_shipping is null)
      or (tax_mode='exclusive_order_half_up' and tax_rate_bps is not null and tax_shipping is not null))
  ));
-- Approved development configuration. Registration numbers, fee, tax rules and stock remain unset.
update public.store_settings set free_shipping_threshold_paise=200000, shipping_coverage='pan_india_serviceable',
  dispatch_origin='Chennai, Tamil Nadu, India', discount_mode='none', whatsapp_number='916379939226',
  secondary_phone='917010379648', enquiry_email='sriharisuvai@gmail.com', instagram_url='https://www.instagram.com/sriharisuvai/'
where settings_key='default' and not checkout_enabled;
grant select (enquiry_email,instagram_url,tax_mode,tax_rate_bps,tax_shipping,discount_mode) on public.store_settings to anon,authenticated;
alter table public.orders add column pricing_snapshot jsonb;
-- The original unnamed constraint survived the later, tax-aware constraint.
-- orders_grand_total_paise_check continues to validate all four components.
alter table public.orders drop constraint orders_check;

-- Keep activation a separate, explicit operation. Setting a rule never opens checkout.
create function public.configure_checkout_pricing(p_coverage text,p_pins text[],p_flat_paise integer,
  p_free_threshold_paise integer,p_tax_mode text,p_tax_bps integer,p_tax_shipping boolean,p_discount_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not shs_private.is_admin() then raise insufficient_privilege; end if;
  if (select checkout_enabled from public.store_settings where settings_key='default' for update) then
    raise exception 'Disable checkout before replacing pricing rules'; end if;
  update public.store_settings set shipping_coverage=p_coverage, serviceable_postal_codes=p_pins,
    flat_shipping_paise=p_flat_paise,free_shipping_threshold_paise=p_free_threshold_paise,
    tax_mode=p_tax_mode,tax_rate_bps=p_tax_bps,tax_shipping=p_tax_shipping,discount_mode=p_discount_mode
    where settings_key='default';
  perform public.write_audit_log(actor,'store.checkout_pricing','store_settings','default','Updated checkout pricing rules',
    jsonb_build_object('coverage',p_coverage,'pins',p_pins,'flatPaise',p_flat_paise,'freeThresholdPaise',p_free_threshold_paise,
      'taxMode',p_tax_mode,'taxBps',p_tax_bps,'taxShipping',p_tax_shipping,'discountMode',p_discount_mode));
end $$;
revoke all on function public.configure_checkout_pricing(text,text[],integer,integer,text,integer,boolean,text) from public,anon,service_role;
grant execute on function public.configure_checkout_pricing(text,text[],integer,integer,text,integer,boolean,text) to authenticated;

create function public.set_store_registrations(p_gstin text, p_fssai text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not shs_private.is_admin() then raise insufficient_privilege; end if;
  update public.store_settings set gstin=nullif(btrim(p_gstin),''),fssai_license_number=nullif(btrim(p_fssai),'')
    where settings_key='default' and not checkout_enabled;
  if not found then raise exception 'Disable checkout before changing registrations'; end if;
  perform public.write_audit_log(actor,'store.registrations','store_settings','default','Updated registration details');
end $$;
revoke all on function public.set_store_registrations(text,text) from public,anon,service_role;
grant execute on function public.set_store_registrations(text,text) to authenticated;

drop function public.create_pending_order(text,uuid,text,text,text,jsonb,text,integer,integer,uuid,jsonb);
create or replace function public.create_pending_order(
  p_order_number text,
  p_user_id uuid,
  p_email text,
  p_phone text,
  p_customer_name text,
  p_address_snapshot jsonb,
  p_customer_note text,
  p_subtotal_paise integer,
  p_shipping_paise integer,
  p_idempotency_key uuid,
  p_items jsonb,
  p_tax_paise integer default 0,
  p_discount_paise integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  settings public.store_settings%rowtype;
  line_count int;
  distinct_variants int;
  computed_subtotal bigint;
  expected_shipping int;
  expected_tax bigint;
  total bigint;
begin
  select * into strict settings from public.store_settings where settings_key='default' for share;
  if not settings.checkout_enabled or not settings.policies_approved or not settings.product_ordering_enabled
    or settings.flat_shipping_paise is null or (p_user_id is null and not settings.guest_checkout_enabled) then
    raise exception 'Checkout disabled' using errcode='SH003';
  end if;
  if coalesce(p_address_snapshot->>'postalCode','') !~ '^[1-9][0-9]{5}$' or
    not coalesce((p_address_snapshot->>'postalCode')=any(settings.serviceable_postal_codes),false) then
    raise exception 'Address outside delivery area' using errcode='SH004';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 64 then
    raise exception 'Order items are required';
  end if;

  select count(*),count(distinct item.product_variant_id),sum(item.unit_price_paise::bigint*item.quantity)
    into line_count,distinct_variants,computed_subtotal from jsonb_to_recordset(p_items)
    as item(product_variant_id uuid,unit_price_paise integer,quantity integer);
  expected_shipping:=case when computed_subtotal>settings.free_shipping_threshold_paise then 0 else settings.flat_shipping_paise end;
  expected_tax:=case when settings.tax_mode='none' then 0 else
    ((computed_subtotal + case when settings.tax_shipping then expected_shipping else 0 end) * settings.tax_rate_bps + 5000) / 10000 end;
  total:=computed_subtotal+expected_shipping+expected_tax;
  if total not between 1 and 2147483647 or p_tax_paise is distinct from expected_tax or p_discount_paise is distinct from 0
     or line_count<>distinct_variants or computed_subtotal is distinct from p_subtotal_paise or computed_subtotal<=0
     or expected_shipping is distinct from p_shipping_paise then
    raise exception 'Review checkout totals' using errcode='SH004';
  end if;
  insert into public.orders (
    order_number, user_id, email, phone, customer_name, address_snapshot, customer_note,
    subtotal_paise, shipping_paise, tax_paise, discount_paise, grand_total_paise, pricing_snapshot, idempotency_key
  ) values (
    p_order_number, p_user_id, p_email, p_phone, p_customer_name, p_address_snapshot, p_customer_note,
    p_subtotal_paise, p_shipping_paise, expected_tax, 0, total,
    jsonb_build_object('origin',settings.dispatch_origin,'coverage',settings.shipping_coverage,'flatPaise',settings.flat_shipping_paise,
      'freeThresholdPaise',settings.free_shipping_threshold_paise,'taxMode',settings.tax_mode,
      'taxRateBps',settings.tax_rate_bps,'taxShipping',settings.tax_shipping,'discountMode',settings.discount_mode), p_idempotency_key
  ) returning id into new_order_id;

  insert into public.order_items (
    order_id, product_id, product_variant_id, product_name, product_slug, variant_name,
    weight_grams, unit_price_paise, quantity, line_total_paise
  )
  select
    new_order_id, item.product_id, item.product_variant_id, item.product_name, item.product_slug,
    item.variant_name, item.weight_grams, item.unit_price_paise, item.quantity,
    item.unit_price_paise * item.quantity
  from jsonb_to_recordset(p_items) as item(
    product_id uuid,
    product_variant_id uuid,
    product_name text,
    product_slug text,
    variant_name text,
    weight_grams integer,
    unit_price_paise integer,
    quantity integer
  ) order by item.product_variant_id;

  if exists (select 1 from public.order_items i left join public.inventory_reservations r
      on r.order_id=i.order_id and r.variant_id=i.product_variant_id
      where i.order_id=new_order_id and r.variant_id is null) then
    raise exception 'Finished-pack inventory required' using errcode='SH002';
  end if;

  insert into public.order_status_history (order_id, status, note)
  values (new_order_id, 'pending', 'Order created; payment pending.');
  return new_order_id;
end;
$$;

revoke all on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb, integer, integer) to service_role;
