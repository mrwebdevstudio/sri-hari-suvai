import { noStoreJson } from "@/lib/http";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
  let databaseReachable = false;
  let checkoutEnabled = false;
  if (supabaseConfigured) {
    try {
      const { data, error } = await createPublicSupabaseClient().from("store_settings")
        .select("checkout_enabled, product_ordering_enabled, flat_shipping_paise").eq("settings_key", "default")
        .abortSignal(AbortSignal.timeout(3_000)).single();
      databaseReachable = !error && Boolean(data);
      checkoutEnabled = Boolean(data?.checkout_enabled && data.product_ordering_enabled && data.flat_shipping_paise !== null);
    } catch { /* Report degraded without disclosing provider details. */ }
  }
  const ready = databaseReachable && razorpayConfigured && checkoutEnabled;
  return noStoreJson({
    status: ready ? "ready" : "degraded",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.APP_VERSION || null,
    services: { supabaseConfigured, databaseReachable, razorpayConfigured, checkoutEnabled },
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503 });
}
