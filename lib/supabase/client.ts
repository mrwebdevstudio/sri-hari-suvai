import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

function requirePublicConfig() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured.");
  return config;
}

export function createBrowserSupabaseClient(options?: { detectSessionInUrl?: boolean }) {
  const config = requirePublicConfig();
  return createBrowserClient(config.url, config.publishableKey, {
    isSingleton: false,
    auth: {
      detectSessionInUrl: options?.detectSessionInUrl ?? true,
    },
  });
}

export function createImplicitCallbackSupabaseClient() {
  const config = requirePublicConfig();
  const memory = new Map<string, string>();
  const client = createClient(config.url, config.publishableKey, {
    auth: {
      flowType: "implicit",
      autoRefreshToken: false,
      detectSessionInUrl: true,
      persistSession: true,
      storage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => {
          memory.set(key, value);
        },
        removeItem: (key) => {
          memory.delete(key);
        },
      },
    },
  });

  return { client, clear: () => memory.clear() };
}
