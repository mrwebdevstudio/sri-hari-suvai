"use client";

import { useState, type FormEvent } from "react";

import { formatPrice } from "@/lib/currency";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";
import { isSafeHttpUrl } from "@/lib/admin";

type TrackedOrder = {
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  subtotal_paise: number;
  shipping_paise: number;
  grand_total_paise: number;
  tracking_number: string | null;
  courier: string | null;
  tracking_url: string | null;
  shipping_note: string | null;
  created_at: string;
  order_items: { product_name: string; variant_name: string; quantity: number; line_total_paise: number }[];
  order_status_history: { id: string; status: OrderStatus; note: string | null; created_at: string }[];
};

export function TrackOrderForm() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setOrder(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json() as { error?: string; order?: TrackedOrder };
      if (!response.ok || !result.order) throw new Error(result.error || "Order could not be found.");
      setOrder(result.order);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Order tracking failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="tracking-layout">
      <form className="auth-card form-stack" onSubmit={submit}>
        <p className="eyebrow">Guest tracking</p><h2>Find your order</h2><p>Use the order number and the same phone number entered at checkout.</p>
        <label>Order number<input name="orderNumber" placeholder="SHS-YYYYMMDD-XXXXXX" autoCapitalize="characters" required /></label>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" required /></label>
        {message ? <p className="form-message form-message--error" role="status">{message}</p> : null}
        <button className="button" type="submit" disabled={loading}>{loading ? "Checking…" : "Track order"}</button>
      </form>
      {order ? <section className="account-panel order-detail" aria-live="polite"><p className="eyebrow">Order status</p><h2>{order.order_number}</h2><div className="order-meta"><span className="status-badge">{orderStatusLabels[order.status]}</span><span>Payment: {order.payment_status}</span><span>{new Date(order.created_at).toLocaleString("en-IN")}</span></div><div className="order-items">{order.order_items.map((item, index) => <article key={`${item.product_name}-${index}`}><div><h3>{item.product_name}</h3><p>{item.variant_name} × {item.quantity}</p></div><strong>{formatPrice(item.line_total_paise)}</strong></article>)}</div><dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal_paise)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(order.shipping_paise)}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.grand_total_paise)}</dd></div></dl><h3>Tracking</h3><p>{order.tracking_number ? <>{order.courier || "Courier"}: {order.tracking_number}{order.tracking_url && isSafeHttpUrl(order.tracking_url) ? <><br /><a className="text-link" href={order.tracking_url} target="_blank" rel="noreferrer">Track shipment</a></> : null}{order.shipping_note ? <><br />{order.shipping_note}</> : null}</> : "Tracking will appear after dispatch."}</p><ol className="order-timeline">{[...order.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((event) => <li key={event.id}><strong>{orderStatusLabels[event.status]}</strong><span>{new Date(event.created_at).toLocaleString("en-IN")}</span>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></section> : null}
    </div>
  );
}
