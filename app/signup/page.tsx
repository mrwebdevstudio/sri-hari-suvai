import type { Metadata } from "next";
import Link from "next/link";

import { signupAction } from "@/app/auth-actions";
import { AuthMessage, AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Customer account" title="Create your account" description="Use Supabase Auth to securely access saved addresses and order history.">
      <AuthMessage error={query.error} />
      <form className="form-stack" action={signupAction}>
        <label>Full name<input name="fullName" autoComplete="name" maxLength={100} required /></label>
        <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" inputMode="tel" /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="button" type="submit">Create account</button>
      </form>
      <p className="auth-inline">Already registered? <Link href="/login">Log in</Link>.</p>
    </AuthShell>
  );
}
