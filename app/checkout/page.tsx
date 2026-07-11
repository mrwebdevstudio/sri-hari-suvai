import type { Metadata } from "next";

import { CheckoutForm, type CheckoutDefaults } from "@/components/checkout/CheckoutForm";
import { getOptionalUser } from "@/lib/auth";
import { getPublicStoreSettings } from "@/lib/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function getDefaults(): Promise<CheckoutDefaults> {
  const user = await getOptionalUser();
  if (!user) return {};
  try {
    const supabase = await createServerSupabaseClient();
    const [{ data: profile }, { data: address }] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
      supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at").limit(1).maybeSingle(),
    ]);
    return {
      name: address?.recipient_name || profile?.full_name || "",
      phone: address?.phone || profile?.phone || "",
      email: user.email || "",
      addressLine1: address?.address_line_1 || "",
      addressLine2: address?.address_line_2 || "",
      city: address?.city || "",
      state: address?.state || "",
      postalCode: address?.postal_code || "",
    };
  } catch {
    return { email: user.email || "" };
  }
}

export default async function CheckoutPage() {
  const [settings, defaults] = await Promise.all([getPublicStoreSettings(), getDefaults()]);
  return (
    <div className="page-wrap">
      <header className="page-hero shell"><p className="eyebrow">Secure checkout</p><h1>Complete your order</h1><p>Products, prices, shipping, and totals are verified again on the server.</p></header>
      <section className="section section--first shell"><CheckoutForm settings={settings} defaults={defaults} /></section>
    </div>
  );
}
