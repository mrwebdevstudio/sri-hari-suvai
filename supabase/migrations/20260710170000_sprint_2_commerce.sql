create extension if not exists pgcrypto;

create type public.profile_role as enum ('customer', 'admin');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text check (phone is null or phone ~ '^\d{10,15}$'),
  role public.profile_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 100),
  phone text not null check (phone ~ '^\d{10,15}$'),
  address_line_1 text not null check (char_length(address_line_1) between 1 and 200),
  address_line_2 text check (address_line_2 is null or char_length(address_line_2) <= 200),
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  postal_code text not null check (postal_code ~ '^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 1 and 150),
  category text not null check (char_length(category) between 1 and 100),
  summary text not null default '',
  usage text not null default '',
  image_alt text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  weight_grams integer not null check (weight_grams > 0),
  price_paise integer not null check (price_paise >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, weight_grams)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^SHS-[0-9]{8}-[A-Z2-9]{6}$'),
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (phone ~ '^\d{10,15}$'),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  address_snapshot jsonb not null check (jsonb_typeof(address_snapshot) = 'object'),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  shipping_paise integer not null check (shipping_paise >= 0),
  grand_total_paise integer not null check (grand_total_paise = subtotal_paise + shipping_paise),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_initialization_token uuid,
  payment_initialization_started_at timestamptz,
  idempotency_key uuid not null unique,
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 100),
  courier text check (courier is null or char_length(courier) <= 100),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  variant_name text not null,
  weight_grams integer not null check (weight_grams > 0),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_paise integer not null check (line_total_paise = unit_price_paise * quantity),
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_event_id text not null unique,
  event_type text not null check (char_length(event_type) between 1 and 100),
  provider_payment_id text,
  resulting_status public.payment_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  settings_key text not null unique default 'default' check (settings_key = 'default'),
  flat_shipping_paise integer check (flat_shipping_paise is null or flat_shipping_paise >= 0),
  free_shipping_threshold_paise integer check (free_shipping_threshold_paise is null or free_shipping_threshold_paise >= 0),
  checkout_enabled boolean not null default false,
  business_phone text check (business_phone is null or char_length(business_phone) <= 30),
  whatsapp_number text check (whatsapp_number is null or char_length(whatsapp_number) <= 30),
  business_address text check (business_address is null or char_length(business_address) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses(user_id);
create unique index addresses_one_default_per_user_idx on public.addresses(user_id) where is_default;
create index products_active_idx on public.products(active) where active;
create index product_variants_product_active_idx on public.product_variants(product_id, active);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_phone_idx on public.orders(phone);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_payment_status_idx on public.orders(payment_status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index order_status_history_order_idx on public.order_status_history(order_id, created_at);
create index payment_events_order_idx on public.payment_events(order_id, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger addresses_set_updated_at before update on public.addresses
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.manage_default_address()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  elsif tg_op = 'INSERT' and not exists (
    select 1 from public.addresses where user_id = new.user_id
  ) then
    new.is_default = true;
  end if;
  return new;
end;
$$;

create trigger addresses_manage_default
before insert or update of is_default on public.addresses
for each row execute function public.manage_default_address();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_events enable row level security;
alter table public.store_settings enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id and role = 'customer');
create policy "profiles_update_own_or_admin" on public.profiles
for update to authenticated
using ((select auth.uid()) = id or (select public.is_admin()))
with check ((select auth.uid()) = id or (select public.is_admin()));
create policy "profiles_delete_admin" on public.profiles
for delete to authenticated using ((select public.is_admin()));

create policy "addresses_select_own_or_admin" on public.addresses
for select to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "addresses_insert_own_or_admin" on public.addresses
for insert to authenticated with check ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "addresses_update_own_or_admin" on public.addresses
for update to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()))
with check ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "addresses_delete_own_or_admin" on public.addresses
for delete to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy "products_public_read_active" on public.products
for select to anon, authenticated using (active or (select public.is_admin()));
create policy "products_admin_insert" on public.products
for insert to authenticated with check ((select public.is_admin()));
create policy "products_admin_update" on public.products
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "products_admin_delete" on public.products
for delete to authenticated using ((select public.is_admin()));

create policy "variants_public_read_active" on public.product_variants
for select to anon, authenticated using (
  (active and exists (select 1 from public.products p where p.id = product_id and p.active))
  or (select public.is_admin())
);
create policy "variants_admin_insert" on public.product_variants
for insert to authenticated with check ((select public.is_admin()));
create policy "variants_admin_update" on public.product_variants
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "variants_admin_delete" on public.product_variants
for delete to authenticated using ((select public.is_admin()));

create policy "orders_select_own_or_admin" on public.orders
for select to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "orders_admin_update" on public.orders
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "order_items_select_own_or_admin" on public.order_items
for select to authenticated using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))
));

create policy "order_history_select_own_or_admin" on public.order_status_history
for select to authenticated using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))
));
create policy "order_history_admin_insert" on public.order_status_history
for insert to authenticated with check ((select public.is_admin()));

create policy "payment_events_admin_read" on public.payment_events
for select to authenticated using ((select public.is_admin()));

create policy "store_settings_public_read" on public.store_settings
for select to anon, authenticated using (true);
create policy "store_settings_admin_insert" on public.store_settings
for insert to authenticated with check ((select public.is_admin()));
create policy "store_settings_admin_update" on public.store_settings
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "store_settings_admin_delete" on public.store_settings
for delete to authenticated using ((select public.is_admin()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name, phone) on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.products, public.product_variants to anon, authenticated;
grant insert, update, delete on public.products, public.product_variants to authenticated;
grant select on public.orders, public.order_items, public.order_status_history to authenticated;
grant update (status, tracking_number, courier, updated_at) on public.orders to authenticated;
grant insert on public.order_status_history to authenticated;
grant select on public.payment_events to authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to authenticated;

create function public.apply_payment_event(
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
begin
  if p_target_status not in ('paid', 'failed', 'refunded') then
    raise exception 'Unsupported payment status';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  insert into public.payment_events (
    order_id, provider_event_id, event_type, provider_payment_id, resulting_status, payload
  ) values (
    p_order_id,
    p_provider_event_id,
    p_event_type,
    nullif(p_provider_payment_id, ''),
    p_target_status::public.payment_status,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then return false; end if;

  if p_target_status = 'paid' then
    if current_order.payment_status = 'paid'
       and current_order.razorpay_payment_id is distinct from nullif(p_provider_payment_id, '') then
      raise exception 'Order already paid with a different payment';
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
  elsif p_target_status = 'refunded' and current_order.payment_status in ('paid', 'refunded') then
    update public.orders set payment_status = 'refunded' where id = p_order_id;
  end if;

  return true;
end;
$$;

revoke all on function public.apply_payment_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(uuid, text, text, text, text, jsonb) to service_role;

create function public.create_pending_order(
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
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
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
  );

  insert into public.order_status_history (order_id, status, note)
  values (new_order_id, 'pending', 'Order created; payment pending.');
  return new_order_id;
end;
$$;

revoke all on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_order(text, uuid, text, text, text, jsonb, text, integer, integer, uuid, jsonb) to service_role;

create function public.update_order_fulfillment(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_status text,
  p_tracking_number text,
  p_courier text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status public.order_status;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and role = 'admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Invalid order status';
  end if;

  select status into previous_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  update public.orders
  set status = p_status::public.order_status,
      tracking_number = nullif(p_tracking_number, ''),
      courier = nullif(p_courier, '')
  where id = p_order_id;

  if previous_status is distinct from p_status::public.order_status then
    insert into public.order_status_history (order_id, status, note, created_by)
    values (p_order_id, p_status::public.order_status, nullif(p_note, ''), p_admin_user_id);
  end if;
  return true;
end;
$$;

revoke all on function public.update_order_fulfillment(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_order_fulfillment(uuid, uuid, text, text, text, text) to service_role;

create function public.claim_payment_initialization(p_order_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set payment_initialization_token = p_token,
      payment_initialization_started_at = now()
  where id = p_order_id
    and razorpay_order_id is null
    and (
      payment_initialization_token is null
      or payment_initialization_started_at < now() - interval '2 minutes'
    );
  return found;
end;
$$;

create function public.finish_payment_initialization(p_order_id uuid, p_token uuid, p_provider_order_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set razorpay_order_id = coalesce(nullif(p_provider_order_id, ''), razorpay_order_id),
      payment_status = case when nullif(p_provider_order_id, '') is not null then 'pending'::public.payment_status else payment_status end,
      payment_initialization_token = null,
      payment_initialization_started_at = null
  where id = p_order_id and payment_initialization_token = p_token;
  return found;
end;
$$;

revoke all on function public.claim_payment_initialization(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_payment_initialization(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_payment_initialization(uuid, uuid) to service_role;
grant execute on function public.finish_payment_initialization(uuid, uuid, text) to service_role;

insert into public.store_settings (settings_key, checkout_enabled)
values ('default', false);

insert into public.products (slug, name, category, summary, usage, image_alt) values
('sambar-podi', 'Sambar Podi', 'Instant Mix', 'A measured podi for preparing a comforting bowl of sambar.', 'Use to prepare sambar.', 'Sambar Podi product'),
('rasam-podi', 'Rasam Podi', 'Instant Mix', 'A convenient podi for preparing aromatic South Indian rasam.', 'Use to prepare rasam.', 'Rasam Podi product'),
('vathakkuzhambu-podi', 'Vathakkuzhambu Podi', 'Instant Mix', 'A practical podi for preparing vathakkuzhambu at home.', 'Use to prepare vathakkuzhambu.', 'Vathakkuzhambu Podi product'),
('vendhya-kuzhambu-podi', 'Vendhya Kuzhambu Podi', 'Instant Mix', 'A convenient podi for preparing vendhya kuzhambu.', 'Use to prepare vendhya kuzhambu.', 'Vendhya Kuzhambu Podi product'),
('morkuzhambu-podi', 'Morkuzhambu Podi', 'Instant Mix', 'A measured podi for preparing traditional morkuzhambu.', 'Use to prepare morkuzhambu.', 'Morkuzhambu Podi product'),
('poriyal-podi', 'Poriyal Podi', 'Instant Mix', 'A convenient podi for bringing a finished touch to poriyal.', 'Use while preparing vegetable poriyal.', 'Poriyal Podi product'),
('koottu-podi', 'Koottu Podi', 'Instant Mix', 'A practical podi for preparing a homestyle koottu.', 'Use to prepare koottu.', 'Koottu Podi product'),
('kuruma-podi', 'Kuruma Podi', 'Instant Mix', 'A measured podi for preparing a rich vegetable kuruma.', 'Use to prepare kuruma.', 'Kuruma Podi product'),
('bisibelabath-podi', 'Bisibelabath Podi', 'Instant Mix', 'A convenient podi for preparing a warm bowl of bisibelabath.', 'Use to prepare bisibelabath.', 'Bisibelabath Podi product'),
('arisi-upma-mix', 'Arisi Upma Mix', 'Instant Mix', 'A ready mix for preparing a simple serving of arisi upma.', 'Use to prepare arisi upma.', 'Arisi Upma Mix product'),
('puliyodharai-podi', 'Puliyodharai Podi', 'Direct Mix', 'A direct mix for preparing tangy puliyodharai rice.', 'Mix with rice to prepare puliyodharai.', 'Puliyodharai Podi product'),
('paruppu-podi', 'Paruppu Podi', 'Direct Mix', 'A direct-mix podi made to accompany warm rice.', 'Mix with warm rice and serve.', 'Paruppu Podi product'),
('dhaniya-podi', 'Dhaniya Podi', 'Direct Mix', 'A versatile direct-mix podi for serving with warm rice.', 'Mix with warm rice and serve.', 'Dhaniya Podi product'),
('idly-podi', 'Idly Podi', 'Direct Mix', 'A classic podi accompaniment for idly and dosa.', 'Serve as an accompaniment to idly or dosa.', 'Idly Podi product'),
('thenga-podi', 'Thenga Podi', 'Direct Mix', 'A direct-mix podi for serving alongside warm rice.', 'Mix with warm rice and serve.', 'Thenga Podi product'),
('vellai-ellu-podi', 'Vellai Ellu Podi', 'Direct Mix', 'A white sesame podi intended as a direct rice accompaniment.', 'Mix with warm rice and serve.', 'Vellai Ellu Podi product');

insert into public.product_variants (product_id, weight_grams, price_paise)
select p.id, seed.weight_grams, seed.price_paise
from (values
  ('sambar-podi', 100, 10000), ('sambar-podi', 250, 20000), ('sambar-podi', 500, 40000), ('sambar-podi', 1000, 80000),
  ('rasam-podi', 100, 10000), ('rasam-podi', 250, 20000), ('rasam-podi', 500, 40000), ('rasam-podi', 1000, 80000),
  ('vathakkuzhambu-podi', 100, 9000), ('vathakkuzhambu-podi', 250, 17500), ('vathakkuzhambu-podi', 500, 35000), ('vathakkuzhambu-podi', 1000, 70000),
  ('vendhya-kuzhambu-podi', 100, 9000), ('vendhya-kuzhambu-podi', 250, 17500), ('vendhya-kuzhambu-podi', 500, 35000), ('vendhya-kuzhambu-podi', 1000, 70000),
  ('morkuzhambu-podi', 100, 9000), ('morkuzhambu-podi', 250, 17500), ('morkuzhambu-podi', 500, 35000), ('morkuzhambu-podi', 1000, 70000),
  ('poriyal-podi', 100, 10000), ('poriyal-podi', 250, 20000), ('poriyal-podi', 500, 40000), ('poriyal-podi', 1000, 80000),
  ('koottu-podi', 100, 10000), ('koottu-podi', 250, 20000), ('koottu-podi', 500, 40000), ('koottu-podi', 1000, 80000),
  ('kuruma-podi', 100, 12500), ('kuruma-podi', 250, 22500), ('kuruma-podi', 500, 45000), ('kuruma-podi', 1000, 90000),
  ('bisibelabath-podi', 100, 12500), ('bisibelabath-podi', 250, 22500), ('bisibelabath-podi', 500, 45000), ('bisibelabath-podi', 1000, 90000),
  ('arisi-upma-mix', 100, 3500), ('arisi-upma-mix', 250, 7000), ('arisi-upma-mix', 500, 14000), ('arisi-upma-mix', 1000, 28000),
  ('puliyodharai-podi', 100, 9000), ('puliyodharai-podi', 250, 17500), ('puliyodharai-podi', 500, 35000), ('puliyodharai-podi', 1000, 70000),
  ('paruppu-podi', 100, 6500), ('paruppu-podi', 250, 12500), ('paruppu-podi', 500, 25000), ('paruppu-podi', 1000, 50000),
  ('dhaniya-podi', 100, 6500), ('dhaniya-podi', 250, 12500), ('dhaniya-podi', 500, 25000), ('dhaniya-podi', 1000, 50000),
  ('idly-podi', 100, 7500), ('idly-podi', 250, 15000), ('idly-podi', 500, 30000), ('idly-podi', 1000, 60000),
  ('thenga-podi', 100, 10000), ('thenga-podi', 250, 20000), ('thenga-podi', 500, 40000), ('thenga-podi', 1000, 80000),
  ('vellai-ellu-podi', 100, 10000), ('vellai-ellu-podi', 250, 20000), ('vellai-ellu-podi', 500, 40000), ('vellai-ellu-podi', 1000, 80000)
) as seed(slug, weight_grams, price_paise)
join public.products p on p.slug = seed.slug;
