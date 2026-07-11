import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";

import { logoutAction } from "@/app/auth-actions";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireUser("/account");
  return (
    <div className="page-wrap">
      <header className="page-hero shell"><p className="eyebrow">Customer portal</p><h1>Your account</h1><p>Manage your details and follow every order from one secure place.</p></header>
      <section className="section section--first shell account-layout">
        <aside className="account-nav" aria-label="Account navigation">
          <Link href="/account/profile">Profile</Link>
          <Link href="/account/addresses">Addresses</Link>
          <Link href="/account/orders">Orders</Link>
          <form action={logoutAction}><button className="text-button" type="submit">Log out</button></form>
        </aside>
        <div className="account-content">{children}</div>
      </section>
    </div>
  );
}
