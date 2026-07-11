-- Sprint 3: admin operations, inventory, audit logging and production hardening.
-- This migration is intentionally additive; do not edit the applied Sprint 2 migration.

alter type public.order_status add value if not exists 'packed' after 'processing';
alter type public.order_status add value if not exists 'out_for_delivery' after 'shipped';

alter table public.products
  add column if not exists sort_order integer not null default 0 check (sort_order >= 0),
  add column if not exists image_path text
    check (image_path is null or image_path ~ '^/images/products/[a-z0-9-]+\.(png|webp|jpg|jpeg)$');

alter table public.product_variants
  drop constraint if exists product_variants_price_paise_check;
alter table public.product_variants
  add constraint product_variants_price_paise_check check (price_paise > 0),
  add column if not exists track_inventory boolean not null default false,
  add column if not exists stock_quantity integer;
alter table public.product_variants
  add constraint product_variants_inventory_check check (
    (not track_inventory and stock_quantity is null)
    or (track_inventory and stock_quantity is not null and stock_quantity >= 0)
  );

alter table public.orders
  drop constraint if exists orders_grand_total_paise_check;
alter table public.orders
  add column if not exists tax_paise integer not null default 0 check (tax_paise >= 0),
  add column if not exists discount_paise integer not null default 0 check (discount_paise >= 0),
  add column if not exists refunded_paise integer not null default 0 check (refunded_paise >= 0),
  add column if not exists currency text not null default 'INR' check (currency = 'INR'),
  add column if not exists payment_gateway text not null default 'razorpay' check (payment_gateway = 'razorpay'),
  add column if not exists tracking_url text
    check (tracking_url is null or tracking_url ~ '^https?://'),
  add column if not exists shipping_note text check (shipping_note is null or char_length(shipping_note) <= 500),
  add column if not exists internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add constraint orders_discount_check check (discount_paise <= subtotal_paise + shipping_paise + tax_paise),
  add constraint orders_refunded_check check (refunded_paise <= grand_total_paise),
  add constraint orders_grand_total_paise_check check (
    grand_total_paise = subtotal_paise + shipping_paise + tax_paise - discount_paise
  );

alter table public.payment_events
  add column if not exists amount_paise integer check (amount_paise is null or amount_paise >= 0),
  add column if not exists currency text check (currency is null or currency = 'INR'),
  add column if not exists signature_verified boolean,
  add column if not exists capture_status text check (capture_status is null or char_length(capture_status) <= 40),
  add column if not exists provider_refund_id text;

alter table public.store_settings
  add column if not exists guest_checkout_enabled boolean not null default true,
  add column if not exists product_ordering_enabled boolean not null default true,
  add column if not exists shipping_notice text check (shipping_notice is null or char_length(shipping_notice) <= 500),
  add column if not exists secondary_phone text check (secondary_phone is null or secondary_phone ~ '^\d{10,15}$'),
  add column if not exists serviceable_postal_codes text[]
    check (serviceable_postal_codes is null or cardinality(serviceable_postal_codes) <= 500),
  add column if not exists low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  add column if not exists order_email_hook_enabled boolean not null default false,
  add column if not exists shipping_email_hook_enabled boolean not null default false,
  add column if not exists maintenance_notice text check (maintenance_notice is null or char_length(maintenance_notice) <= 500),
  add column if not exists policies_approved boolean not null default false;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.profile_role,
  event_type text not null check (event_type ~ '^[a-z0-9_.-]{3,100}$'),
  entity_type text not null check (event_type <> '' and char_length(entity_type) <= 80),
  entity_id text not null check (char_length(entity_id) between 1 and 150),
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  correlation_id text check (correlation_id is null or char_length(correlation_id) <= 100),
  created_at timestamptz not null default now()
);

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  payment_event_id uuid references public.payment_events(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  before_quantity integer not null check (before_quantity >= 0),
  adjustment_delta integer not null check (adjustment_delta <> 0),
  after_quantity integer not null check (after_quantity >= 0),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  check (after_quantity = before_quantity + adjustment_delta)
);

create table public.inventory_payment_applications (
  order_id uuid primary key references public.orders(id) on delete restrict,
  provider_event_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists products_sort_active_idx on public.products(active, sort_order, name);
create index if not exists product_variants_inventory_idx
  on public.product_variants(track_inventory, stock_quantity) where track_inventory;
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_gateway_order_idx on public.orders(razorpay_order_id) where razorpay_order_id is not null;
create index if not exists orders_gateway_payment_idx on public.orders(razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_event_created_idx on public.audit_logs(event_type, created_at desc);
create index if not exists audit_logs_entity_created_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists inventory_adjustments_variant_created_idx
  on public.inventory_adjustments(product_variant_id, created_at desc);
create index if not exists inventory_adjustments_order_idx
  on public.inventory_adjustments(order_id) where order_id is not null;

create function public.reject_append_only_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.reject_append_only_change();

create trigger inventory_adjustments_append_only
before update or delete on public.inventory_adjustments
for each row execute function public.reject_append_only_change();

create function public.write_audit_log(
  p_actor_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if p_actor_user_id is not null and not exists (
    select 1 from public.profiles where id = p_actor_user_id and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, event_type, entity_type, entity_id,
    summary, metadata, correlation_id
  ) values (
    p_actor_user_id,
    case when p_actor_user_id is null then null else 'admin'::public.profile_role end,
    p_event_type, p_entity_type, p_entity_id, p_summary,
    coalesce(p_metadata, '{}'::jsonb), nullif(p_correlation_id, '')
  ) returning id into audit_id;
  return audit_id;
end;
$$;

create function public.admin_update_order_fulfillment(
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

create or replace function public.update_order_fulfillment(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_status text,
  p_tracking_number text,
  p_courier text,
  p_note text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.admin_update_order_fulfillment(
    p_order_id, p_admin_user_id, p_status, p_tracking_number, p_courier,
    null, p_note, null, null, null
  );
$$;

create function public.admin_adjust_inventory(
  p_product_variant_id uuid,
  p_admin_user_id uuid,
  p_delta integer,
  p_reason text,
  p_correlation_id text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant public.product_variants%rowtype;
  after_quantity integer;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  if p_delta = 0 or char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A non-zero adjustment and reason are required';
  end if;

  select * into variant from public.product_variants where id = p_product_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  if not variant.track_inventory or variant.stock_quantity is null then
    raise exception 'Inventory tracking is disabled';
  end if;
  after_quantity := variant.stock_quantity + p_delta;
  if after_quantity < 0 then raise exception 'Stock cannot become negative'; end if;

  update public.product_variants set stock_quantity = after_quantity where id = p_product_variant_id;
  insert into public.inventory_adjustments (
    product_variant_id, actor_user_id, before_quantity, adjustment_delta, after_quantity, reason
  ) values (
    p_product_variant_id, p_admin_user_id, variant.stock_quantity, p_delta, after_quantity, trim(p_reason)
  );
  perform public.write_audit_log(
    p_admin_user_id, 'inventory.stock_adjusted', 'product_variant', p_product_variant_id::text,
    'Stock adjusted from ' || variant.stock_quantity || ' to ' || after_quantity || '.',
    jsonb_build_object('before', variant.stock_quantity, 'delta', p_delta, 'after', after_quantity, 'reason', trim(p_reason)),
    p_correlation_id
  );
  return after_quantity;
end;
$$;

create function public.admin_update_product(
  p_product_id uuid,
  p_admin_user_id uuid,
  p_name text,
  p_category text,
  p_summary text,
  p_usage text,
  p_image_path text,
  p_sort_order integer,
  p_active boolean,
  p_correlation_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_product public.products%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then raise exception 'Admin access required'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 or p_category not in ('Instant Mix', 'Direct Mix') or p_sort_order < 0 then raise exception 'Invalid product values'; end if;
  if nullif(trim(p_image_path), '') is not null and p_image_path !~ '^/images/products/[a-z0-9-]+\.(png|webp|jpg|jpeg)$' then raise exception 'Invalid image path'; end if;
  select * into current_product from public.products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  update public.products set
    name = trim(p_name), category = p_category, summary = coalesce(p_summary, ''), usage = coalesce(p_usage, ''),
    image_path = nullif(trim(p_image_path), ''), sort_order = p_sort_order, active = p_active
  where id = p_product_id;
  perform public.write_audit_log(
    p_admin_user_id,
    case when current_product.active is distinct from p_active then 'product.activation_changed' else 'product.updated' end,
    'product', p_product_id::text, current_product.name || ' was updated.',
    jsonb_build_object('slug', current_product.slug, 'oldName', current_product.name, 'newName', trim(p_name), 'oldActive', current_product.active, 'newActive', p_active),
    p_correlation_id
  );
  return true;
end;
$$;

create function public.admin_update_variant(
  p_variant_id uuid,
  p_admin_user_id uuid,
  p_weight_grams integer,
  p_price_paise integer,
  p_active boolean,
  p_track_inventory boolean,
  p_stock_quantity integer,
  p_reason text,
  p_correlation_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_variant public.product_variants%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then raise exception 'Admin access required'; end if;
  if p_weight_grams <= 0 or p_price_paise <= 0 then raise exception 'Invalid variant values'; end if;
  if (p_track_inventory and (p_stock_quantity is null or p_stock_quantity < 0)) or (not p_track_inventory and p_stock_quantity is not null) then raise exception 'Invalid inventory values'; end if;
  select * into current_variant from public.product_variants where id = p_variant_id for update;
  if not found then raise exception 'Variant not found'; end if;
  if current_variant.stock_quantity is distinct from p_stock_quantity and char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Inventory change reason required'; end if;

  update public.product_variants set
    weight_grams = p_weight_grams, price_paise = p_price_paise, active = p_active,
    track_inventory = p_track_inventory, stock_quantity = p_stock_quantity
  where id = p_variant_id;
  if current_variant.stock_quantity is not null and p_stock_quantity is not null and current_variant.stock_quantity <> p_stock_quantity then
    insert into public.inventory_adjustments (
      product_variant_id, actor_user_id, before_quantity, adjustment_delta, after_quantity, reason
    ) values (
      p_variant_id, p_admin_user_id, current_variant.stock_quantity,
      p_stock_quantity - current_variant.stock_quantity, p_stock_quantity, trim(p_reason)
    );
  end if;
  perform public.write_audit_log(
    p_admin_user_id,
    case
      when current_variant.price_paise <> p_price_paise then 'variant.price_changed'
      when current_variant.active is distinct from p_active then 'variant.activation_changed'
      when current_variant.track_inventory is distinct from p_track_inventory then 'variant.inventory_tracking_changed'
      else 'variant.updated'
    end,
    'product_variant', p_variant_id::text,
    case when current_variant.price_paise <> p_price_paise then 'Variant price changed.' else 'Variant settings updated.' end,
    jsonb_build_object(
      'productId', current_variant.product_id, 'weightGrams', p_weight_grams,
      'oldPricePaise', current_variant.price_paise, 'newPricePaise', p_price_paise,
      'oldActive', current_variant.active, 'newActive', p_active,
      'inventoryTracking', p_track_inventory
    ),
    p_correlation_id
  );
  return true;
end;
$$;

create function public.admin_update_store_settings(
  p_admin_user_id uuid,
  p_updates jsonb,
  p_correlation_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then raise exception 'Admin access required'; end if;
  if jsonb_typeof(p_updates) <> 'object' then raise exception 'Invalid settings payload'; end if;

  update public.store_settings set
    checkout_enabled = (p_updates ->> 'checkout_enabled')::boolean,
    guest_checkout_enabled = (p_updates ->> 'guest_checkout_enabled')::boolean,
    product_ordering_enabled = (p_updates ->> 'product_ordering_enabled')::boolean,
    flat_shipping_paise = nullif(p_updates ->> 'flat_shipping_paise', '')::integer,
    free_shipping_threshold_paise = nullif(p_updates ->> 'free_shipping_threshold_paise', '')::integer,
    shipping_notice = nullif(trim(p_updates ->> 'shipping_notice'), ''),
    business_phone = nullif(p_updates ->> 'business_phone', ''),
    secondary_phone = nullif(p_updates ->> 'secondary_phone', ''),
    whatsapp_number = nullif(p_updates ->> 'whatsapp_number', ''),
    business_address = nullif(trim(p_updates ->> 'business_address'), ''),
    serviceable_postal_codes = case
      when jsonb_typeof(p_updates -> 'serviceable_postal_codes') = 'array'
        then array(select jsonb_array_elements_text(p_updates -> 'serviceable_postal_codes'))
      else null
    end,
    low_stock_threshold = nullif(p_updates ->> 'low_stock_threshold', '')::integer,
    order_email_hook_enabled = (p_updates ->> 'order_email_hook_enabled')::boolean,
    shipping_email_hook_enabled = (p_updates ->> 'shipping_email_hook_enabled')::boolean,
    maintenance_notice = nullif(trim(p_updates ->> 'maintenance_notice'), ''),
    policies_approved = (p_updates ->> 'policies_approved')::boolean
  where settings_key = 'default';

  perform public.write_audit_log(
    p_admin_user_id, 'store_settings.updated', 'store_settings', 'default', 'Store settings updated.',
    jsonb_build_object('submittedKeys', (select jsonb_agg(key order by key) from jsonb_object_keys(p_updates) as changed_key(key))),
    p_correlation_id
  );
  return true;
end;
$$;

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
  stock_row record;
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
  if inserted_event_id is null then return false; end if;

  if p_target_status = 'paid' then
    if event_amount is null or event_amount <> current_order.grand_total_paise or event_currency <> current_order.currency then
      raise exception 'Payment amount or currency mismatch';
    end if;
    if current_order.payment_status = 'paid'
       and current_order.razorpay_payment_id is distinct from nullif(p_provider_payment_id, '') then
      raise exception 'Order already paid with a different payment';
    end if;

    if not exists (select 1 from public.inventory_payment_applications where order_id = p_order_id) then
      perform 1
      from public.product_variants v
      join public.order_items oi on oi.product_variant_id = v.id
      where oi.order_id = p_order_id and v.track_inventory
      for update of v;

      if exists (
        select 1
        from public.order_items oi
        join public.product_variants v on v.id = oi.product_variant_id
        where oi.order_id = p_order_id and v.track_inventory
        group by v.id, v.stock_quantity
        having v.stock_quantity is null or v.stock_quantity < sum(oi.quantity)
      ) then
        raise exception 'Insufficient tracked inventory';
      end if;

      for stock_row in
        select v.id, v.stock_quantity, sum(oi.quantity)::integer as sold_quantity
        from public.order_items oi
        join public.product_variants v on v.id = oi.product_variant_id
        where oi.order_id = p_order_id and v.track_inventory
        group by v.id, v.stock_quantity
      loop
        update public.product_variants
        set stock_quantity = stock_row.stock_quantity - stock_row.sold_quantity
        where id = stock_row.id;
        insert into public.inventory_adjustments (
          product_variant_id, order_id, payment_event_id, before_quantity,
          adjustment_delta, after_quantity, reason
        ) values (
          stock_row.id, p_order_id, inserted_event_id, stock_row.stock_quantity,
          -stock_row.sold_quantity, stock_row.stock_quantity - stock_row.sold_quantity,
          'Verified payment inventory decrement'
        );
      end loop;

      insert into public.inventory_payment_applications (order_id, provider_event_id)
      values (p_order_id, p_provider_event_id);
    end if;

    update public.orders
    set payment_status = 'paid',
        razorpay_payment_id = coalesce(razorpay_payment_id, nullif(p_provider_payment_id, '')),
        paid_at = coalesce(paid_at, now()),
        status = case when status = 'pending' then 'confirmed'::public.order_status else status end
    where id = p_order_id;
    if current_order.status = 'pending' then
      insert into public.order_status_history (order_id, status, note)
      values (p_order_id, 'confirmed', 'Payment confirmed.');
    end if;
  elsif p_target_status = 'failed' and current_order.payment_status not in ('paid', 'refunded') then
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

alter table public.audit_logs enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_payment_applications enable row level security;

create policy audit_logs_admin_read on public.audit_logs
for select to authenticated using ((select public.is_admin()));
create policy inventory_adjustments_admin_read on public.inventory_adjustments
for select to authenticated using ((select public.is_admin()));

drop policy if exists products_admin_delete on public.products;
drop policy if exists variants_admin_delete on public.product_variants;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists variants_admin_insert on public.product_variants;
drop policy if exists variants_admin_update on public.product_variants;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists order_history_admin_insert on public.order_status_history;
drop policy if exists store_settings_admin_insert on public.store_settings;
drop policy if exists store_settings_admin_update on public.store_settings;
drop policy if exists store_settings_admin_delete on public.store_settings;
revoke insert, update, delete on public.products, public.product_variants, public.store_settings from authenticated;
revoke update on public.orders from authenticated;
revoke insert on public.order_status_history from authenticated;

revoke all on public.audit_logs, public.inventory_adjustments, public.inventory_payment_applications from anon, authenticated;
grant select on public.audit_logs, public.inventory_adjustments to authenticated;

revoke select on public.store_settings from anon, authenticated;
grant select (
  settings_key, checkout_enabled, guest_checkout_enabled, product_ordering_enabled,
  flat_shipping_paise, free_shipping_threshold_paise, shipping_notice,
  business_phone, secondary_phone, whatsapp_number, business_address,
  serviceable_postal_codes, maintenance_notice, policies_approved
) on public.store_settings to anon, authenticated;

revoke select on public.orders, public.order_status_history from authenticated;
grant select (
  id, order_number, user_id, email, phone, customer_name, address_snapshot, customer_note,
  subtotal_paise, shipping_paise, tax_paise, discount_paise, grand_total_paise,
  status, payment_status, tracking_number, courier, tracking_url, shipping_note,
  paid_at, shipped_at, delivered_at, created_at, updated_at, refunded_paise, currency
) on public.orders to authenticated;
grant select (id, order_id, status, note, created_at) on public.order_status_history to authenticated;

revoke all on function public.write_audit_log(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_update_order_fulfillment(uuid, uuid, text, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_product(uuid, uuid, text, text, text, text, text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_update_variant(uuid, uuid, integer, integer, boolean, boolean, integer, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_store_settings(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.update_order_fulfillment(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.apply_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit_log(uuid, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.admin_update_order_fulfillment(uuid, uuid, text, text, text, text, text, text, timestamptz, text) to service_role;
grant execute on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) to service_role;
grant execute on function public.admin_update_product(uuid, uuid, text, text, text, text, text, integer, boolean, text) to service_role;
grant execute on function public.admin_update_variant(uuid, uuid, integer, integer, boolean, boolean, integer, text, text) to service_role;
grant execute on function public.admin_update_store_settings(uuid, jsonb, text) to service_role;
grant execute on function public.update_order_fulfillment(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.apply_payment_event(uuid, text, text, text, text, jsonb) to service_role;
