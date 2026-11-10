-- Executed solely in the disposable PGlite Auth schema. No passwords or hosted identities.
do $$
declare owner_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email) values(owner_id,'sriharisuvai@gmail.com'),(other_id,'customer@example.invalid');
  update auth.users set raw_user_meta_data=jsonb_build_object('shs_permanent_admin_id',id,'role','admin'),
    email_confirmed_at=now() where id=other_id;
  update auth.users set raw_app_meta_data=jsonb_build_object('shs_permanent_admin_id',id) where id in(owner_id,other_id);
  if exists(select 1 from public.profiles where role='admin') then raise exception 'Premature grant'; end if;
  begin
    update public.profiles set role='admin' where id=other_id;
    raise exception 'Non-owner received admin';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role='admin' where id=owner_id;
    raise exception 'Unconfirmed owner received admin';
  exception when insufficient_privilege then null; end;
  update auth.users set email_confirmed_at=now() where id=owner_id;
  if exists(select 1 from public.profiles where role='admin') then raise exception 'Invite session alone activated owner'; end if;
  -- Simulate Auth changing its opaque credential column. No password is used.
  update auth.users set encrypted_password=gen_random_uuid()::text where id=owner_id;
  if not exists(select 1 from public.profiles where id=owner_id and role='admin') then raise exception 'Password setup did not activate owner'; end if;
  begin
    update public.profiles set role='admin' where id=other_id;
    raise exception 'Second administrator accepted';
  exception when insufficient_privilege or unique_violation then null; end;
  update auth.users set email='different@example.invalid' where id=owner_id;
  if exists(select 1 from public.profiles where role='admin') then raise exception 'Changed email retained role'; end if;
  update auth.users set email='sriharisuvai@gmail.com' where id=owner_id;
  update auth.users set raw_app_meta_data='{}' where id=owner_id;
  if exists(select 1 from public.profiles where role='admin') then raise exception 'Email alone conferred privileges'; end if;
  update auth.users set raw_app_meta_data=jsonb_build_object('shs_permanent_admin_id',id) where id=owner_id;
  perform set_config('shs_test.ephemeral_owner',owner_id::text,false);
end $$;
