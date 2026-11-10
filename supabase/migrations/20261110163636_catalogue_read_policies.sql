create index products_category_sort_idx on public.products(category,sort_order,name);
alter policy published_products on public.products to anon;
alter policy published_variants on public.product_variants to anon;
alter policy admin_product_reads on public.products using(active or (select shs_private.is_admin()));
alter policy admin_variant_reads on public.product_variants using(
 (active and exists(select 1 from public.products p where p.id=product_id and p.active))
 or (select shs_private.is_admin())
);
