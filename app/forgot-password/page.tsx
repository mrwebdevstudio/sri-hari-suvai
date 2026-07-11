import type { Metadata } from "next";

import { forgotPasswordAction } from "@/app/auth-actions";
import { AuthMessage, AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Account recovery" title="Reset your password" description="We will ask Supabase Auth to send a secure reset link.">
      <AuthMessage error={query.error} message={query.message} />
      <form className="form-stack" action={forgotPasswordAction}>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <button className="button" type="submit">Send reset link</button>
      </form>
    </AuthShell>
  );
}
