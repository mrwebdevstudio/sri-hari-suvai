"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addressInputFromFormData, isValidPhone, normalizePhone } from "@/lib/validation";

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser("/account/profile");
  const fullName = String(formData.get("fullName") || "").trim().slice(0, 100);
  const phone = normalizePhone(formData.get("phone"));
  if (!fullName) errorRedirect("/account/profile", "Name is required.");
  if (phone && !isValidPhone(phone)) errorRedirect("/account/profile", "Enter a valid phone number.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", user.id);
  if (error) errorRedirect("/account/profile", error.message);
  revalidatePath("/account/profile");
  redirect("/account/profile?message=Profile%20updated.");
}

export async function createAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const parsed = addressInputFromFormData(formData);
  if (!parsed.data) errorRedirect("/account/addresses", parsed.error || "Invalid address.");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    recipient_name: parsed.data.name,
    phone: parsed.data.phone,
    address_line_1: parsed.data.addressLine1,
    address_line_2: parsed.data.addressLine2,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
    is_default: formData.get("isDefault") === "on",
  });
  if (error) errorRedirect("/account/addresses", error.message);
  revalidatePath("/account/addresses");
  redirect("/account/addresses?message=Address%20saved.");
}

export async function updateAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const id = String(formData.get("id") || "");
  const parsed = addressInputFromFormData(formData);
  if (!id || !parsed.data) errorRedirect("/account/addresses", parsed.error || "Invalid address.");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("addresses").update({
    recipient_name: parsed.data.name,
    phone: parsed.data.phone,
    address_line_1: parsed.data.addressLine1,
    address_line_2: parsed.data.addressLine2,
    city: parsed.data.city,
    state: parsed.data.state,
    postal_code: parsed.data.postalCode,
    is_default: formData.get("isDefault") === "on",
  }).eq("id", id).eq("user_id", user.id);
  if (error) errorRedirect("/account/addresses", error.message);
  revalidatePath("/account/addresses");
  redirect("/account/addresses?message=Address%20updated.");
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const id = String(formData.get("id") || "");
  const supabase = await createServerSupabaseClient();
  const { data: address } = await supabase.from("addresses").select("is_default").eq("id", id).eq("user_id", user.id).single();
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) errorRedirect("/account/addresses", error.message);
  if (address?.is_default) {
    const { data: replacement } = await supabase.from("addresses").select("id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
    if (replacement) await supabase.from("addresses").update({ is_default: true }).eq("id", replacement.id).eq("user_id", user.id);
  }
  revalidatePath("/account/addresses");
  redirect("/account/addresses?message=Address%20deleted.");
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const id = String(formData.get("id") || "");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) errorRedirect("/account/addresses", error.message);
  revalidatePath("/account/addresses");
}
