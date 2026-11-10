-- Staff can upload an immutable draft. Uploading does not change any listing.
create policy staff_stage_product_image on storage.objects for insert to authenticated with check (
 bucket_id='product-images' and (select shs_private.is_admin())
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 and exists(select 1 from public.products p where p.id::text=split_part(name,'/',1))
);
alter policy current_catalogue_object on storage.objects to anon;
create policy customer_or_staff_image on storage.objects for select to authenticated using (
 bucket_id='product-images' and ((select shs_private.is_admin()) or exists(select 1 from public.product_images i where i.object_name=storage.objects.name))
);
