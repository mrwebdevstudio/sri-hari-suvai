import Link from "next/link";
import { notFound } from "next/navigation";

import { updateOrderAction } from "@/app/admin/actions";
import { AdminNotice, AdminPageHeader, StatusBadge } from "@/components/admin/AdminUi";
import { formatPrice } from "@/lib/currency";
import { getAdminOrder } from "@/lib/admin-data";
import { fulfilmentTransitions, isSafeHttpUrl } from "@/lib/admin";
import { orderStatusLabels, type OrderStatus } from "@/lib/orders";

type Query = { message?: string; error?: string };
type AdminOrderItem = { id: string; product_name: string; variant_name: string; quantity: number; unit_price_paise: number; line_total_paise: number };
type AdminAuditEntry = { id: string; summary: string; event_type: string; created_at: string; metadata: Record<string, unknown> };

export default async function AdminOrderDetailPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<Query> }) {
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);
  const order = await getAdminOrder(orderNumber);
  if (!order) notFound();
  const address = (order.address_snapshot || {}) as Record<string, string>;
  const history = [...(order.order_status_history || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const paymentEvents = [...(order.payment_events || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const latestPayment = paymentEvents[0];
  const currentStatus = order.status as OrderStatus;
  const allowedStatuses = [currentStatus, ...fulfilmentTransitions[currentStatus]];
  return (
    <>
      <AdminPageHeader eyebrow="Order detail" title={order.order_number} description={`Placed ${new Date(order.created_at).toLocaleString("en-IN")}`} actions={<Link href="/admin/orders">Back to orders</Link>} />
      <AdminNotice message={query.message} error={query.error} />
      <div className="admin-order-heading"><StatusBadge value={order.payment_status} /><StatusBadge value={order.status} />{order.refunded_paise ? <span>{formatPrice(order.refunded_paise)} refunded</span> : null}</div>

      <div className="admin-order-grid">
        <section className="admin-section admin-order-primary">
          <div className="admin-section-head"><div><p className="eyebrow">Items</p><h2>Order summary</h2></div></div>
          <div className="admin-order-items">{order.order_items.map((item: AdminOrderItem) => <article key={item.id}><div><strong>{item.product_name}</strong><span>{item.variant_name} · {item.quantity} × {formatPrice(item.unit_price_paise)}</span></div><strong>{formatPrice(item.line_total_paise)}</strong></article>)}</div>
          <dl className="admin-totals"><div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal_paise)}</dd></div><div><dt>Shipping</dt><dd>{formatPrice(order.shipping_paise)}</dd></div><div><dt>Tax</dt><dd>{formatPrice(order.tax_paise || 0)}</dd></div><div><dt>Discount</dt><dd>−{formatPrice(order.discount_paise || 0)}</dd></div><div><dt>Total</dt><dd>{formatPrice(order.grand_total_paise)}</dd></div></dl>
        </section>

        <aside className="admin-section admin-customer-card">
          <p className="eyebrow">Customer</p><h2>{order.customer_name}</h2><dl className="admin-detail-list"><div><dt>Email</dt><dd>{order.email}</dd></div><div><dt>Phone</dt><dd>{order.phone}</dd></div><div><dt>Order note</dt><dd>{order.customer_note || "None"}</dd></div></dl>
          <h3>Shipping address</h3><address>{address.name}<br />{address.addressLine1}{address.addressLine2 ? <><br />{address.addressLine2}</> : null}<br />{address.city}, {address.state} {address.postalCode}<br />{address.phone}</address>
        </aside>
      </div>

      <section className="admin-section">
        <div className="admin-section-head"><div><p className="eyebrow">Fulfilment</p><h2>Status and tracking</h2></div></div>
        <form className="admin-form admin-form-grid" action={updateOrderAction}>
          <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="orderNumber" value={order.order_number} />
          <label>Status<select name="status" defaultValue={order.status}>{allowedStatuses.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}</select></label>
          <label>Courier<input name="courier" defaultValue={order.courier || ""} maxLength={100} /></label>
          <label>Tracking number<input name="trackingNumber" defaultValue={order.tracking_number || ""} maxLength={100} /></label>
          <label>Tracking URL<input name="trackingUrl" type="url" defaultValue={order.tracking_url || ""} maxLength={500} placeholder="https://" /></label>
          <label>Shipping date<input name="shippingDate" type="datetime-local" defaultValue={order.shipped_at ? String(order.shipped_at).slice(0, 16) : ""} /></label>
          <label className="admin-form-span">Customer-visible shipment note<textarea name="customerNote" defaultValue={order.shipping_note || ""} maxLength={500} /></label>
          <label className="admin-form-span">Internal note<textarea name="internalNote" defaultValue={order.internal_note || ""} maxLength={1000} /><span>Never shown to the customer.</span></label>
          <div className="admin-form-span admin-form-actions"><button className="button" type="submit">Save order update</button></div>
        </form>
        {order.tracking_url && isSafeHttpUrl(order.tracking_url) ? <p className="admin-safe-link">Current customer link: <a href={order.tracking_url} target="_blank" rel="noreferrer">{order.tracking_url}</a></p> : null}
      </section>

      <div className="admin-two-column">
        <section className="admin-section">
          <div className="admin-section-head"><div><p className="eyebrow">Payment reconciliation</p><h2>Razorpay state</h2></div></div>
          <dl className="admin-detail-list"><div><dt>Local status</dt><dd><StatusBadge value={order.payment_status} /></dd></div><div><dt>Expected amount</dt><dd>{formatPrice(order.grand_total_paise)} {order.currency || "INR"}</dd></div><div><dt>Gateway order ID</dt><dd>{order.razorpay_order_id || "Not assigned"}</dd></div><div><dt>Gateway payment ID</dt><dd>{order.razorpay_payment_id || "Not assigned"}</dd></div><div><dt>Paid at</dt><dd>{order.paid_at ? new Date(order.paid_at).toLocaleString("en-IN") : "Not paid"}</dd></div><div><dt>Last event</dt><dd>{latestPayment?.event_type || "None"}</dd></div><div><dt>Gateway amount</dt><dd>{latestPayment?.amount_paise === null || latestPayment?.amount_paise === undefined ? "Not stored" : formatPrice(latestPayment.amount_paise)}</dd></div><div><dt>Signature verified</dt><dd>{latestPayment?.signature_verified === null || latestPayment?.signature_verified === undefined ? "Not recorded" : latestPayment.signature_verified ? "Yes" : "No"}</dd></div><div><dt>Capture status</dt><dd>{latestPayment?.capture_status || "Not recorded"}</dd></div><div><dt>Refunded</dt><dd>{formatPrice(order.refunded_paise || 0)}</dd></div></dl>
          <p className="admin-help">Refund execution remains in Razorpay. Local refund state changes only after a verified gateway webhook.</p>
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><div><p className="eyebrow">Timeline</p><h2>Customer-visible status</h2></div></div>
          <ol className="order-timeline">{history.map((event) => <li key={event.id}><strong>{orderStatusLabels[event.status as OrderStatus]}</strong><span>{new Date(event.created_at).toLocaleString("en-IN")}</span>{event.note ? <p>{event.note}</p> : null}</li>)}</ol>
        </section>
      </div>

      <section className="admin-section">
        <div className="admin-section-head"><div><p className="eyebrow">Accountability</p><h2>Order audit history</h2></div></div>
        {order.audit_logs.length ? <div className="admin-audit-list">{order.audit_logs.map((entry: AdminAuditEntry) => <article key={entry.id}><div><strong>{entry.summary}</strong><span>{entry.event_type} · {new Date(entry.created_at).toLocaleString("en-IN")}</span></div><details><summary>Safe metadata</summary><pre>{JSON.stringify(entry.metadata, null, 2)}</pre></details></article>)}</div> : <p className="admin-help">No admin audit events have been recorded for this order.</p>}
      </section>
    </>
  );
}
