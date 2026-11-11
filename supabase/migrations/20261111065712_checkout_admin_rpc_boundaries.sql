-- Expose invoker RPCs only. Each private implementation still verifies auth.uid() and the staff profile.

alter function public.configure_checkout_pricing(text, text[], integer, integer, text, integer, boolean, text) set schema shs_private;
create function public.configure_checkout_pricing(p_coverage text, p_pins text[], p_flat_paise integer, p_free_threshold_paise integer,
  p_tax_mode text, p_tax_bps integer, p_tax_shipping boolean, p_discount_mode text)
returns void language sql security invoker set search_path='' as $$
  select shs_private.configure_checkout_pricing(p_coverage, p_pins, p_flat_paise, p_free_threshold_paise, p_tax_mode, p_tax_bps, p_tax_shipping, p_discount_mode);
$$;
revoke all on function public.configure_checkout_pricing(text, text[], integer, integer, text, integer, boolean, text) from public, anon, service_role;
grant execute on function public.configure_checkout_pricing(text, text[], integer, integer, text, integer, boolean, text) to authenticated;

alter function public.set_store_registrations(text, text) set schema shs_private;
create function public.set_store_registrations(p_gstin text, p_fssai text)
returns void language sql security invoker set search_path='' as $$
  select shs_private.set_store_registrations(p_gstin, p_fssai);
$$;
revoke all on function public.set_store_registrations(text, text) from public, anon, service_role;
grant execute on function public.set_store_registrations(text, text) to authenticated;

alter function public.release_order_reservations(uuid, text) set schema shs_private;
create function public.release_order_reservations(p_order_id uuid, p_reason text)
returns boolean language sql security invoker set search_path='' as $$
  select shs_private.release_order_reservations(p_order_id, p_reason);
$$;
revoke all on function public.release_order_reservations(uuid, text) from public, anon, service_role;
grant execute on function public.release_order_reservations(uuid, text) to authenticated;

alter function public.reconcile_captured_inventory(uuid, text) set schema shs_private;
create function public.reconcile_captured_inventory(p_order_id uuid, p_reason text)
returns boolean language sql security invoker set search_path='' as $$
  select shs_private.reconcile_captured_inventory(p_order_id, p_reason);
$$;
revoke all on function public.reconcile_captured_inventory(uuid, text) from public, anon, service_role;
grant execute on function public.reconcile_captured_inventory(uuid, text) to authenticated;
