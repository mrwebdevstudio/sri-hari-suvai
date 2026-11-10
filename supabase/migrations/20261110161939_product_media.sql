insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',false,4194304,array['image/png','image/jpeg','image/webp']);

create table public.product_images (
 product_id uuid primary key references public.products on delete cascade,
 object_name text not null unique check (object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$' and split_part(object_name,'/',1)=product_id::text),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.product_images enable row level security;
revoke all on public.product_images from anon,authenticated;
grant select on public.product_images to anon,authenticated;
grant select,insert,update,delete on public.product_images to service_role;
create policy published_image on public.product_images for select to anon,authenticated using
 (exists(select 1 from public.products p where p.id=product_id and p.active));
create policy current_catalogue_object on storage.objects for select to anon,authenticated using
 (bucket_id='product-images' and exists(select 1 from public.product_images i where i.object_name=storage.objects.name));

-- Replacements use fresh keys. The caller removes only the displaced unreferenced object.
create function public.admin_set_product_image(p_actor uuid,p_product uuid,p_object text)
returns text language plpgsql set search_path='' as $$
declare old_name text;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Admin required'; end if;
 perform 1 from public.products where id=p_product for update;
 if not found then raise exception 'Unknown product'; end if;
 select object_name into old_name from public.product_images where product_id=p_product;
 if p_object is null then delete from public.product_images where product_id=p_product;
 else
   if not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_object) then raise exception 'Object missing'; end if;
   insert into public.product_images(product_id,object_name) values(p_product,p_object)
   on conflict(product_id) do update set object_name=excluded.object_name,updated_at=now();
 end if;
 perform public.write_audit_log(p_actor,'product.image','product',p_product::text,'Changed primary product image');
 return old_name;
end $$;
create function public.admin_create_product(p_actor uuid,p_slug text,p_name text,p_category text,p_prices integer[])
returns uuid language plpgsql set search_path='' as $$
declare pid uuid;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Admin required'; end if;
 if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug)>100 or cardinality(p_prices) is distinct from 4
 or exists(select 1 from unnest(p_prices) x where x is null or x<=0) then raise exception 'Invalid product or four prices'; end if;
 insert into public.products(slug,name,category,active) values(p_slug,trim(p_name),p_category,false) returning id into pid;
 insert into public.product_variants(product_id,weight_grams,price_paise)
 select pid,w,p_prices[n] from unnest(array[100,250,500,1000]) with ordinality as weights(w,n);
 perform public.write_audit_log(p_actor,'product.created','product',pid::text,'Created unpublished product and four variants');
 return pid;
end $$;
revoke all on function public.admin_set_product_image(uuid,uuid,text),public.admin_create_product(uuid,text,text,text,integer[]) from public,anon,authenticated;
grant execute on function public.admin_set_product_image(uuid,uuid,text),public.admin_create_product(uuid,text,text,text,integer[]) to service_role;
