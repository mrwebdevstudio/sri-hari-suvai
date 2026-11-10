import "server-only";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function hasSupabaseServerKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createAdminSupabaseClient() {
  const config = getSupabasePublicConfig();
  // The SDK accepts an opaque secret. The environment variable name is retained for existing installations.
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !secretKey) throw new Error("Supabase server credentials are not configured.");

  return createClient(config.url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
