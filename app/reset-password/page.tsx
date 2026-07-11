import type { Metadata } from "next";

import { resetPasswordAction } from "@/app/auth-actions";
import { AuthMessage, AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Account recovery" title="Choose a new password" description="Your reset link must be opened before this form can update your password.">
      <AuthMessage error={query.error} />
      <form className="form-stack" action={resetPasswordAction}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Confirm password<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="button" type="submit">Update password</button>
      </form>
    </AuthShell>
  );
}
