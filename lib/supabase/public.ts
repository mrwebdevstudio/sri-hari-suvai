import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createPublicSupabaseClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
