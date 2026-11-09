import type { Metadata } from "next";

import { AuthCallbackClient } from "@/app/auth/callback/AuthCallbackClient";
import { AuthShell } from "@/components/auth/AuthShell";
import { resolveAuthCallbackFlow, safeAuthRedirectPath } from "@/lib/auth-flow";

export const metadata: Metadata = {
  title: "Verifying secure link",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string; next?: string }>;
}) {
  const query = await searchParams;
  const flow = resolveAuthCallbackFlow(query.flow, query.next);
  const next = safeAuthRedirectPath(query.next, flow === "recovery" ? "/reset-password" : "/account/profile");

  return (
    <AuthShell eyebrow="Secure account link" title="Verifying your link" description="Please wait while Sri Hari Suvai completes authentication.">
      <AuthCallbackClient flow={flow} next={next} />
    </AuthShell>
  );
}
