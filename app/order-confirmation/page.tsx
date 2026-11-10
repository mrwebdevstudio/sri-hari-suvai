import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getOptionalUser } from "@/lib/auth";
import { ORDER_RECEIPT_COOKIE, paymentConfirmationCopy, verifyOrderReceipt } from "@/lib/order-receipt";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const query = await searchParams;
  const orderNumber = typeof query.order === "string" ? query.order : "";
  let verifiedOrder: { order_number: string; payment_status: string } | null = null;
  if (/^SHS-\d{8}-[A-Z2-9]{6}$/.test(orderNumber)) {
    try {
      const receipt = (await cookies()).get(ORDER_RECEIPT_COOKIE)?.value || "";
      const user = await getOptionalUser();
      if (user) {
        const supabase = await createServerSupabaseClient();
        const { data } = await supabase.from("orders").select("order_number, payment_status")
          .eq("order_number", orderNumber).eq("user_id", user.id).maybeSingle();
        verifiedOrder = data;
      }
      if (!verifiedOrder && verifyOrderReceipt(receipt, orderNumber, process.env.RAZORPAY_KEY_SECRET?.trim() || "")) {
        const { data, error } = await createAdminSupabaseClient().from("orders")
          .select("order_number, payment_status").eq("order_number", orderNumber).maybeSingle();
        if (!error) verifiedOrder = data;
      }
    } catch { /* Never infer payment success when verification is unavailable. */ }
  }
  const copy = paymentConfirmationCopy(verifiedOrder?.payment_status || null);
  return (
    <div className="page-wrap"><section className="section section--first shell account-shell"><div className="auth-card"><p className="eyebrow">Order status</p><h1>{copy.title}</h1><p>{copy.message}</p>{verifiedOrder ? <p>Your order number is <strong>{verifiedOrder.order_number}</strong>. Keep it for tracking.</p> : null}<div className="auth-links"><Link className="button" href="/account/orders">View my orders</Link><Link className="button button--secondary" href="/track-order">Track as guest</Link></div></div></section></div>
  );
}
