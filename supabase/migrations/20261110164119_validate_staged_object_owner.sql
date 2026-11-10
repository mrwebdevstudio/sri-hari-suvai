alter policy staff_stage_product_image on storage.objects with check (
 bucket_id='product-images' and (select shs_private.is_admin())
 and storage.objects.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
 and exists(select 1 from public.products p where p.id::text=split_part(storage.objects.name,'/',1))
);
