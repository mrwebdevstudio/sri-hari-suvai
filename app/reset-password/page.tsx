import type { Metadata } from "next";

import { resetPasswordAction } from "@/app/auth-actions";
import { AuthMessage, AuthShell } from "@/components/auth/AuthShell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [query] = await Promise.all([searchParams, requireUser("/reset-password")]);
  return (
    <AuthShell eyebrow="Account recovery" title="Choose a new password" description="Your reset link must be opened before this form can update your password.">
      <AuthMessage error={query.error} message={query.message} />
      <form className="form-stack" action={resetPasswordAction}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Confirm password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="button" type="submit">Update password</button>
      </form>
    </AuthShell>
  );
}
