import type { Metadata } from "next";
import Link from "next/link";

import { loginAction } from "@/app/auth-actions";
import { AuthMessage, AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Login", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const query = await searchParams;
  return (
    <AuthShell eyebrow="Customer account" title="Welcome back" description="Log in to manage your profile, addresses, and orders.">
      <AuthMessage error={query.error} message={query.message} />
      <form className="form-stack" action={loginAction}>
        <input type="hidden" name="next" value={query.next || "/account"} />
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="button" type="submit">Log in</button>
      </form>
      <div className="auth-links"><Link href="/forgot-password">Forgot password?</Link><Link href="/signup">Create account</Link></div>
    </AuthShell>
  );
}
