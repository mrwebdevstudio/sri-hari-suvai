import Link from "next/link";

import { formatPrice } from "@/lib/currency";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const supabase = await createServerSupabaseClient();
  const { data: orders } = await supabase.from("orders").select("order_number, status, payment_status, grand_total_paise, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return (
    <section className="account-panel">
      <p className="eyebrow">Orders</p><h2>Order history</h2>
      {orders?.length ? <div className="order-list">{orders.map((order) => <Link className="order-card" href={`/account/orders/${order.order_number}`} key={order.order_number}><div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleDateString("en-IN")}</span></div><div><span className="status-badge">{orderStatusLabels[order.status as OrderStatus]}</span><strong>{formatPrice(order.grand_total_paise)}</strong></div></Link>)}</div> : <div className="empty-state"><h3>No orders yet</h3><p>Your paid and pending orders will appear here.</p><Link className="button" href="/shop">Start shopping</Link></div>}
    </section>
  );
}
