-- Invitations can establish a session before the recipient has chosen a password.
-- Existing confirmed password holders can retain their credentials when nominated.
create or replace function shs_private.sync_store_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare next_role public.profile_role;
begin
  if not shs_private.is_nominated_store_owner(new.id) then
    next_role := 'customer';
  elsif old.email_confirmed_at is not null and lower(old.email)=lower(new.email)
    and nullif(new.encrypted_password,'') is not null
    and (old.encrypted_password is distinct from new.encrypted_password
         or (old.raw_app_meta_data ->> 'shs_permanent_admin_id') is distinct from new.id::text) then
    next_role := 'admin';
  else
    return new;
  end if;
  update public.profiles set role=next_role where id=new.id and role<>next_role;
  if found then
    perform public.write_audit_log(null,'profile.admin_assignment','profile',new.id::text,
      'Updated the nominated store administrator',jsonb_build_object('role',next_role));
  end if;
  return new;
end $$;
drop trigger sync_store_admin on auth.users;
create trigger sync_store_admin after update of email,email_confirmed_at,raw_app_meta_data,deleted_at,encrypted_password on auth.users
for each row when (
  old.raw_app_meta_data ->> 'shs_permanent_admin_id' = old.id::text
  or new.raw_app_meta_data ->> 'shs_permanent_admin_id' = new.id::text
) execute function shs_private.sync_store_admin();
