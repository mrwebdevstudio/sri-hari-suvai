create table public.carts (
 user_id uuid primary key references auth.users on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cart_items (
 user_id uuid not null references public.carts on delete cascade,
 variant_id uuid not null references public.product_variants on delete cascade,
 quantity integer not null check(quantity between 1 and 99),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,variant_id)
);
create index cart_items_variant_idx on public.cart_items(variant_id);
create table shs_private.cart_imports (
 user_id uuid not null references public.carts on delete cascade, import_id uuid not null,
 created_at timestamptz not null default now(), primary key(user_id,import_id)
);
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table shs_private.cart_imports enable row level security;
create policy own_cart on public.carts to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_cart_items on public.cart_items to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.product_variants v where v.id=variant_id and v.active));
create policy own_imports on shs_private.cart_imports to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.carts,public.cart_items,shs_private.cart_imports from public,anon,authenticated;
grant select,insert on public.carts,shs_private.cart_imports to authenticated;
grant update(updated_at) on public.carts to authenticated;
grant select,insert,delete on public.cart_items to authenticated;
grant update(quantity,updated_at) on public.cart_items to authenticated;

create function public.my_cart(p_action text,p_items jsonb default '[]',p_import_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); entry jsonb; variant uuid; qty integer; result jsonb;
begin
 if owner_id is null or p_action not in ('load','merge','add','set','remove','clear') or p_action is null
 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 then raise exception 'Invalid cart request'; end if;
 insert into public.carts(user_id) values(owner_id) on conflict do nothing;
 perform 1 from public.carts where user_id=owner_id for update;
 if p_action='merge' then
   if p_import_id is null then raise exception 'Import identifier required'; end if;
   insert into shs_private.cart_imports(user_id,import_id) values(owner_id,p_import_id) on conflict do nothing;
   if not found then p_action:='load'; end if;
 end if;
 if p_action='clear' then delete from public.cart_items where user_id=owner_id;
 elsif p_action<>'load' then
   if p_action<>'merge' and jsonb_array_length(p_items)<>1 then raise exception 'One cart line required'; end if;
   for entry in select value from jsonb_array_elements(p_items) loop
     qty:=(entry->>'quantity')::integer;
     if qty is null or qty not between 1 and 99 then raise exception 'Invalid quantity'; end if;
     select v.id into variant from public.product_variants v join public.products p on p.id=v.product_id
       where p.slug=entry->>'productSlug' and p.active and v.active and v.weight_grams=(entry->>'weightGrams')::integer;
     if not found then
       if p_action='merge' then continue; end if;
       raise exception 'Unknown pack';
     end if;
     if p_action='remove' then delete from public.cart_items where user_id=owner_id and variant_id=variant;
     else
       insert into public.cart_items(user_id,variant_id,quantity) values(owner_id,variant,qty)
       on conflict(user_id,variant_id) do update set quantity=case when p_action='set' then excluded.quantity else least(99,public.cart_items.quantity+excluded.quantity) end, updated_at=now();
     end if;
   end loop;
 end if;
 if p_action<>'load' then update public.carts set updated_at=now() where user_id=owner_id; end if;
 select coalesce(jsonb_agg(jsonb_build_object('productSlug',p.slug,'weightGrams',v.weight_grams,'quantity',i.quantity) order by i.created_at,i.variant_id),'[]') into result
 from public.cart_items i join public.product_variants v on v.id=i.variant_id join public.products p on p.id=v.product_id
 where i.user_id=owner_id and v.active and p.active;
 return result;
end $$;
revoke all on function public.my_cart(text,jsonb,uuid) from public,anon;
grant execute on function public.my_cart(text,jsonb,uuid) to authenticated;
