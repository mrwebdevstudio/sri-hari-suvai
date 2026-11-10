-- This application exposes public through PostgREST. Keep authority helpers private.
create schema if not exists shs_private;
revoke all on schema shs_private from public;
grant usage on schema shs_private to anon, authenticated, service_role;
alter function public.is_admin() set schema shs_private;
revoke all on function shs_private.is_admin() from public, anon, authenticated;
grant execute on function shs_private.is_admin() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Separate public catalogue reads from authenticated administrator reads.
drop policy products_public_read_active on public.products;
drop policy variants_public_read_active on public.product_variants;
create policy published_products on public.products for select to anon, authenticated using (active);
create policy admin_product_reads on public.products for select to authenticated using ((select shs_private.is_admin()));
create policy published_variants on public.product_variants for select to anon, authenticated
using (active and exists(select 1 from public.products p where p.id=product_id and p.active));
create policy admin_variant_reads on public.product_variants for select to authenticated using ((select shs_private.is_admin()));
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;
drop policy if exists variants_admin_insert on public.product_variants;
drop policy if exists variants_admin_update on public.product_variants;
drop policy if exists variants_admin_delete on public.product_variants;
revoke insert,update,delete,truncate,references,trigger on public.products, public.product_variants,
 public.orders,public.order_items,public.order_status_history,public.payment_events,public.store_settings,
 public.audit_logs,public.inventory_adjustments, public.inventory_payment_applications from anon, authenticated;
revoke truncate,references,trigger on public.profiles, public.addresses from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.addresses,public.products,public.product_variants,
 public.orders,public.order_items,public.order_status_history,public.payment_events,public.store_settings,
 public.audit_logs,public.inventory_adjustments,public.inventory_payment_applications to service_role;

create table public.categories (
 name text primary key check (name in ('Instant Mix','Direct Mix')),
 description text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.categories(name,description) values
 ('Instant Mix','Boil with water and enjoy.'),('Direct Mix','Can be mixed with rice as it is.');
alter table public.categories enable row level security;
create policy category_read on public.categories for select to anon,authenticated using (true);
revoke all on public.categories from anon,authenticated;
grant select on public.categories to anon,authenticated,service_role;
alter table public.products add constraint product_category_fk foreign key(category) references public.categories(name);
alter table public.product_variants add constraint supported_pack check(weight_grams in (100,250,500,1000));
update public.products set name='Vendhya Kuahambu Podi' where slug='vendhya-kuzhambu-podi';
create index if not exists inventory_adjustments_actor_idx on public.inventory_adjustments(actor_user_id);
create index if not exists inventory_adjustments_event_idx on public.inventory_adjustments(payment_event_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists order_items_variant_idx on public.order_items(product_variant_id);
create index if not exists order_history_creator_idx on public.order_status_history(created_by);
create policy internal_inventory_marker on public.inventory_payment_applications for all to anon,authenticated using(false) with check(false);
