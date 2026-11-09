import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/auth-actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminUser, getOptionalUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s | Sri Hari Suvai Admin" }, robots: { index: false, follow: false, nocache: true } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=%2Fadmin");
  const admin = await getAdminUser();
  if (!admin) notFound();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand"><Image src="/brand/spice-mark.png" alt="" width={38} height={46} /><div><strong>Sri Hari Suvai</strong><small>Operations portal</small></div></div>
        <AdminNav />
        <div className="admin-identity"><span title={admin.email || undefined}>{admin.email || "Admin"}</span><Link href="/">Storefront</Link><form action={logoutAction}><button type="submit">Log out</button></form></div>
      </header>
      <div className="admin-body"><div className="admin-main" id="admin-content">{children}</div></div>
    </div>
  );
}
