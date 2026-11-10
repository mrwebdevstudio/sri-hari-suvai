-- Only the Auth Admin API (or the database owner) can nominate a specific UUID
-- in raw_app_meta_data. Customer-editable metadata is never an authority.
create function shs_private.is_nominated_store_owner(subject uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = subject
      and u.raw_app_meta_data ->> 'shs_permanent_admin_id' = u.id::text
      and lower(u.email) = 'sriharisuvai@gmail.com'
      and u.email_confirmed_at is not null and u.deleted_at is null
  );
$$;
revoke all on function shs_private.is_nominated_store_owner(uuid) from public, anon, authenticated;

-- Refuse to adopt or demote an unrelated pre-existing administrator.
do $$ begin
  if exists (select 1 from public.profiles p where p.role='admin'
             and not shs_private.is_nominated_store_owner(p.id)) then
    raise exception 'Review existing administrator before enabling the single-owner policy';
  end if;
end $$;
create unique index profiles_single_store_admin on public.profiles(role) where role='admin';

create function shs_private.guard_store_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role='admin' and not shs_private.is_nominated_store_owner(new.id) then
    raise exception 'Administrator assignment requires the confirmed nominated identity' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function shs_private.guard_store_admin() from public, anon, authenticated;
create trigger guard_store_admin before insert or update of id,role on public.profiles
for each row when (new.role='admin') execute function shs_private.guard_store_admin();

create function shs_private.sync_store_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare next_role public.profile_role;
begin
  next_role := case when shs_private.is_nominated_store_owner(new.id)
    then 'admin'::public.profile_role else 'customer'::public.profile_role end;
  update public.profiles set role=next_role where id=new.id and role<>next_role;
  if found then
    perform public.write_audit_log(null,'profile.admin_assignment','profile',new.id::text,
      'Updated the nominated store administrator',jsonb_build_object('role',next_role));
  end if;
  return new;
end $$;
revoke all on function shs_private.sync_store_admin() from public, anon, authenticated;
create trigger sync_store_admin after update of email,email_confirmed_at,raw_app_meta_data,deleted_at on auth.users
for each row when (
  old.raw_app_meta_data ->> 'shs_permanent_admin_id' = old.id::text
  or new.raw_app_meta_data ->> 'shs_permanent_admin_id' = new.id::text
) execute function shs_private.sync_store_admin();
