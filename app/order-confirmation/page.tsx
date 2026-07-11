import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ order?: string; payment?: string }> }) {
  const query = await searchParams;
  return (
    <div className="page-wrap"><section className="section section--first shell account-shell"><div className="auth-card"><p className="eyebrow">Order received</p><h1>{query.payment === "paid" ? "Payment confirmed" : "Payment is being confirmed"}</h1><p>Your order number is <strong>{query.order || "unavailable"}</strong>. Keep it for tracking. Fulfilment begins only after the server records payment as paid.</p><div className="auth-links"><Link className="button" href="/account/orders">View my orders</Link><Link className="button button--secondary" href="/track-order">Track as guest</Link></div></div></section></div>
  );
}
