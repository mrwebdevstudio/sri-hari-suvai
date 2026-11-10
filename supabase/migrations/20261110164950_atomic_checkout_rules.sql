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
  p_items jsonb
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
begin
  select * into strict settings from public.store_settings where settings_key='default' for share;
  if not settings.checkout_enabled or not settings.policies_approved or not settings.product_ordering_enabled
    or settings.flat_shipping_paise is null or (p_user_id is null and not settings.guest_checkout_enabled) then
    raise exception 'Checkout disabled' using errcode='SH003';
  end if;
  if cardinality(settings.serviceable_postal_codes)>0 and not (coalesce(p_address_snapshot->>'postalCode','')=any(settings.serviceable_postal_codes)) then
    raise exception 'Address outside delivery area' using errcode='SH004';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 64 then
    raise exception 'Order items are required';
  end if;

  select count(*),count(distinct item.product_variant_id),sum(item.unit_price_paise::bigint*item.quantity)
    into line_count,distinct_variants,computed_subtotal from jsonb_to_recordset(p_items)
    as item(product_variant_id uuid,unit_price_paise integer,quantity integer);
  expected_shipping:=case when computed_subtotal>=settings.free_shipping_threshold_paise then 0 else settings.flat_shipping_paise end;
  if line_count<>distinct_variants or computed_subtotal is distinct from p_subtotal_paise or computed_subtotal<=0
     or expected_shipping is distinct from p_shipping_paise then
    raise exception 'Review checkout totals' using errcode='SH004';
  end if;
  insert into public.orders (
    order_number, user_id, email, phone, customer_name, address_snapshot, customer_note,
    subtotal_paise, shipping_paise, grand_total_paise, idempotency_key
  ) values (
    p_order_number, p_user_id, p_email, p_phone, p_customer_name, p_address_snapshot, p_customer_note,
    p_subtotal_paise, p_shipping_paise, p_subtotal_paise + p_shipping_paise, p_idempotency_key
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

  insert into public.order_status_history (order_id, status, note)
  values (new_order_id, 'pending', 'Order created; payment pending.');
  return new_order_id;
end;
$$;

revoke all on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb) to service_role;
