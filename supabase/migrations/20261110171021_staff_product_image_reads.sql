-- Staff previews use the staff member's JWT. Customers see only published bindings.
alter policy published_image on public.product_images to anon;
create policy authenticated_image_read on public.product_images for select to authenticated
using ((select shs_private.is_admin()) or exists (
  select 1 from public.products p where p.id=product_images.product_id and p.active
));
