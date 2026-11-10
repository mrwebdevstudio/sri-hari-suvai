-- An operator must explicitly approve the configured commerce rules before enabling checkout.
alter table public.store_settings add constraint checkout_requires_approved_rules
check(not checkout_enabled or (policies_approved and flat_shipping_paise is not null));

create function public.admin_patch_settings(p_actor uuid,p_patch jsonb)
returns public.store_settings language plpgsql set search_path='' as $$
declare current_settings public.store_settings;
begin
 if jsonb_typeof(p_patch) is distinct from 'object' or exists(
    select 1 from jsonb_object_keys(p_patch) k where k not in ('flat_shipping_paise','free_shipping_threshold_paise','checkout_enabled','business_phone','whatsapp_number','business_address')
 ) then raise exception 'Invalid settings fields'; end if;
 select * into strict current_settings from public.store_settings where settings_key='default' for update;
 perform public.admin_update_store_settings(p_actor,to_jsonb(current_settings)||p_patch,null);
 select * into strict current_settings from public.store_settings where settings_key='default';
 return current_settings;
end $$;
revoke all on function public.admin_patch_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.admin_patch_settings(uuid,jsonb) to service_role;
