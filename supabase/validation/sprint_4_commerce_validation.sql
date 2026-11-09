-- Sprint 4 commerce activation validator.
-- Run after all three commerce migrations in the Supabase SQL editor or through psql.
-- This script is read-only. It reports evidence and never changes project data.

begin transaction read only;

with required_tables(table_name) as (
  values
    ('profiles'), ('addresses'), ('products'), ('product_variants'), ('orders'),
    ('order_items'), ('order_status_history'), ('payment_events'), ('store_settings'),
    ('audit_logs'), ('inventory_adjustments'), ('inventory_payment_applications')
), checks(check_name, passed, detail) as (
  select
    'catalogue_product_count',
    count(*) = 16,
    format('expected=16 actual=%s', count(*))
  from public.products

  union all
  select
    'catalogue_variant_count',
    count(*) = 64,
    format('expected=64 actual=%s', count(*))
  from public.product_variants

  union all
  select
    'catalogue_active_state',
    count(distinct p.id) filter (where p.active) = 16
      and count(v.*) filter (where p.active and v.active) = 64,
    format(
      'active_products=%s active_variants=%s',
      count(distinct p.id) filter (where p.active),
      count(v.*) filter (where p.active and v.active)
    )
  from public.products p
  left join public.product_variants v on v.product_id = p.id

  union all
  select
    'positive_integer_paise',
    count(*) filter (where price_paise <= 0) = 0,
    format('invalid_variant_prices=%s', count(*) filter (where price_paise <= 0))
  from public.product_variants

  union all
  select
    'inventory_state_consistent',
    count(*) filter (
      where (track_inventory and (stock_quantity is null or stock_quantity < 0))
        or (not track_inventory and stock_quantity is not null)
    ) = 0,
    format(
      'tracked_variants=%s inconsistent_variants=%s',
      count(*) filter (where track_inventory),
      count(*) filter (
        where (track_inventory and (stock_quantity is null or stock_quantity < 0))
          or (not track_inventory and stock_quantity is not null)
      )
    )
  from public.product_variants

  union all
  select
    'inventory_history_arithmetic',
    count(*) filter (where after_quantity <> before_quantity + adjustment_delta) = 0,
    format('invalid_adjustments=%s', count(*) filter (where after_quantity <> before_quantity + adjustment_delta))
  from public.inventory_adjustments

  union all
  select
    'audit_entity_type_nonempty',
    count(*) filter (where char_length(entity_type) = 0) = 0,
    format('invalid_audit_rows=%s', count(*) filter (where char_length(entity_type) = 0))
  from public.audit_logs

  union all
  select
    'single_default_store_settings',
    count(*) = 1 and bool_and(settings_key = 'default'),
    format('default_rows=%s', count(*))
  from public.store_settings

  union all
  select
    'commerce_activation_switches',
    bool_and(checkout_enabled and product_ordering_enabled and flat_shipping_paise is not null),
    format(
      'checkout_enabled=%s product_ordering_enabled=%s flat_shipping_paise=%s',
      bool_or(checkout_enabled),
      bool_or(product_ordering_enabled),
      max(flat_shipping_paise)
    )
  from public.store_settings
  where settings_key = 'default'

  union all
  select
    'trusted_admin_present',
    count(*) >= 1,
    format('admin_profiles=%s', count(*))
  from public.profiles
  where role = 'admin'

  union all
  select
    'rls_enabled_on_exposed_tables',
    count(*) = (select count(*) from required_tables),
    format('expected=%s actual=%s', (select count(*) from required_tables), count(*))
  from required_tables r
  join pg_catalog.pg_class c on c.relname = r.table_name and c.relrowsecurity
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'

  union all
  select
    'role_column_not_customer_writable',
    not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
    'authenticated must not have UPDATE on profiles.role'

  union all
  select
    'audit_and_inventory_history_triggers',
    count(*) = 2 and bool_and(t.tgenabled <> 'D'),
    format('enabled_append_only_triggers=%s', count(*) filter (where t.tgenabled <> 'D'))
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and t.tgname in ('audit_logs_append_only', 'inventory_adjustments_append_only')
    and not t.tgisinternal
)
select
  case when passed then 'PASS' else 'FAIL' end as status,
  check_name,
  detail
from checks
order by check_name;

-- Owner-controlled activation values. Review; blank values are not guessed by this validator.
select
  settings_key,
  checkout_enabled,
  guest_checkout_enabled,
  product_ordering_enabled,
  flat_shipping_paise,
  free_shipping_threshold_paise,
  serviceable_postal_codes,
  low_stock_threshold,
  business_phone,
  secondary_phone,
  whatsapp_number,
  business_address,
  shipping_notice,
  maintenance_notice,
  order_email_hook_enabled,
  shipping_email_hook_enabled,
  policies_approved
from public.store_settings
where settings_key = 'default';

-- Inventory coverage and payment-decrement reconciliation evidence.
select
  count(*) filter (where track_inventory) as tracked_variants,
  count(*) filter (where track_inventory and stock_quantity = 0) as out_of_stock_variants,
  count(*) filter (where track_inventory and stock_quantity > 0) as stocked_variants,
  coalesce(sum(stock_quantity) filter (where track_inventory), 0) as total_tracked_units
from public.product_variants;

select
  count(*) as inventory_adjustments,
  count(*) filter (where order_id is not null) as payment_adjustments,
  count(distinct order_id) filter (where order_id is not null) as payment_orders,
  count(*) filter (where payment_event_id is not null) as payment_event_linked_adjustments
from public.inventory_adjustments;

select
  o.order_number,
  o.payment_status,
  ipa.provider_event_id,
  ipa.created_at
from public.orders o
join public.inventory_payment_applications ipa on ipa.order_id = o.id
order by ipa.created_at desc;

-- Static RLS/policy inventory. Runtime A/B-user isolation still requires authenticated test sessions.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles', 'addresses', 'products', 'product_variants', 'orders', 'order_items',
    'order_status_history', 'payment_events', 'store_settings', 'audit_logs',
    'inventory_adjustments', 'inventory_payment_applications'
  )
order by c.relname;

rollback;
