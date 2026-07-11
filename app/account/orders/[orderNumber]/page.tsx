import { notFound } from "next/navigation";

import { formatPrice } from "@/lib/currency";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSafeHttpUrl } from "@/lib/admin";

type OrderItemRow = { id: string; product_name: string; variant_name: string; quantity: number; line_total_paise: number };

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const [{ orderNumber }, user] = await Promise.all([params, requireUser("/account/orders")]);
  const supabase = await createServerSupabaseClient();
  const { data: order } = await supabase.from("orders").select("id, order_number, user_id, address_snapshot, customer_note, subtotal_paise, shipping_paise, tax_paise, discount_paise, grand_total_paise, status, payment_status, tracking_number, courier, tracking_url, shipping_note, paid_at, shipped_at, delivered_at, created_at, order_items(id, product_name, variant_name, quantity, line_total_paise), order_status_history(id, status, note, created_at)").eq("order_number", orderNumber).eq("user_id", user.id).single();
  if (!order) notFound();
  const address = order.address_snapshot as Record<string, string>;
  const history = [...(order.order_status_history || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <section className="account-panel order-detail">
      <p className="eyebrow">Order details</p><h2>{order.order_number}</h2>
      <div className="order-meta"><span className="status-badge">{orderStatusLabels[order.status as OrderStatus]}</span><span>Payment: {order.payment_status}</span><span>Placed {new Date(order.created_at).toLocaleString("en-IN")}</span></div>
      <div className="order-items">{order.order_items.map((item: OrderItemRow) => <article key={item.id}><div><h3>{item.product_name}</h3><p>{item.variant_name} × {item.quantity}</p></div><strong>{formatPrice(item.line_total_paise)}</strong></article>)}</div>
      <dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal_paise)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(order.shipping_paise)}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.grand_total_paise)}</dd></div></dl>
      <div className="order-columns"><section><h3>Delivery address</h3><p>{address.name}<br />{address.addressLine1}{address.addressLine2 ? <><br />{address.addressLine2}</> : null}<br />{address.city}, {address.state} {address.postalCode}<br />{address.phone}</p></section><section><h3>Tracking</h3><p>{order.tracking_number ? <>{order.courier || "Courier"}<br />{order.tracking_number}{order.tracking_url && isSafeHttpUrl(order.tracking_url) ? <><br /><a className="text-link" href={order.tracking_url} target="_blank" rel="noreferrer">Track shipment</a></> : null}{order.shipping_note ? <><br />{order.shipping_note}</> : null}</> : "Tracking will appear here after dispatch."}</p></section></div>
      <section><h3>Status timeline</h3><ol className="order-timeline">{history.map((event) => <li key={event.id}><strong>{orderStatusLabels[event.status as OrderStatus]}</strong><span>{new Date(event.created_at).toLocaleString("en-IN")}</span>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></section>
    </section>
  );
}
