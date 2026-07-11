import { noStoreJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
  return noStoreJson({
    status: supabaseConfigured ? "ready" : "degraded",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.APP_VERSION || null,
    services: { supabaseConfigured, razorpayConfigured },
    timestamp: new Date().toISOString(),
  }, { status: supabaseConfigured ? 200 : 503 });
}
