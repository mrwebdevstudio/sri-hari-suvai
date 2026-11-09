"use client";

import { useEffect, useState } from "react";

import { getAuthCallbackRedirect, type AuthCallbackFlow } from "@/lib/auth-flow";
import {
  createBrowserSupabaseClient,
  createImplicitCallbackSupabaseClient,
} from "@/lib/supabase/client";

function cleanCallbackLocation() {
  window.history.replaceState(window.history.state, "", "/auth/callback");
}

export function AuthCallbackClient({ flow, next }: { flow: AuthCallbackFlow; next: string }) {
  const [status, setStatus] = useState("Verifying your secure link…");

  useEffect(() => {
    let cancelled = false;

    async function completeCallback() {
      let succeeded = false;

      try {
        const callbackUrl = new URL(window.location.href);
        const hasFragment = callbackUrl.hash.length > 1;
        const code = callbackUrl.searchParams.get("code");

        if (hasFragment) {
          const implicit = createImplicitCallbackSupabaseClient();
          const { data, error } = await implicit.client.auth.getSession();
          cleanCallbackLocation();

          if (!error && data.session) {
            const browser = createBrowserSupabaseClient({ detectSessionInUrl: false });
            const { error: sessionError } = await browser.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            succeeded = !sessionError;
          }

          implicit.clear();
        } else if (code) {
          cleanCallbackLocation();
          const browser = createBrowserSupabaseClient({ detectSessionInUrl: false });
          const { data, error } = await browser.auth.exchangeCodeForSession(code);
          succeeded = !error && Boolean(data.session);
        } else {
          cleanCallbackLocation();
        }
      } catch {
        cleanCallbackLocation();
      }

      if (cancelled) return;
      setStatus(succeeded ? "Secure link verified. Redirecting…" : "This secure link could not be verified. Redirecting…");
      window.location.replace(getAuthCallbackRedirect(flow, succeeded, next));
    }

    void completeCallback();
    return () => {
      cancelled = true;
    };
  }, [flow, next]);

  return <p className="form-message" role="status">{status}</p>;
}
