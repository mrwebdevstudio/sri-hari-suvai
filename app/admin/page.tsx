import Link from "next/link";

import { AdminPageHeader, EmptyAdminState, StatusBadge } from "@/components/admin/AdminUi";
import { formatPrice } from "@/lib/currency";
import { getDashboardData } from "@/lib/admin-data";

function relatedProductName(value: unknown): string {
  const record = Array.isArray(value) ? value[0] : value;
  return record && typeof record === "object" && "name" in record ? String(record.name) : "Product";
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  const metrics = [
    ["Orders today", data.metrics.ordersToday],
    ["Paid, awaiting processing", data.metrics.awaiting],
    ["Processing", data.metrics.processing],
    ["Packed", data.metrics.packed],
    ["Shipped", data.metrics.shipped],
    ["Out for delivery", data.metrics.outForDelivery],
    ["Delivered", data.metrics.delivered],
    ["Failed payments", data.metrics.failed],
  ] as const;
  return (
    <>
      <AdminPageHeader eyebrow="Operations overview" title="Dashboard" description="Live store status and the work that needs attention." />
      <section className="admin-metric-grid" aria-label="Order metrics">
        {metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value.toLocaleString("en-IN")}</strong></article>)}
        <article className="admin-metric-wide"><span>Verified net revenue · last 30 days</span><strong>{formatPrice(data.metrics.netPaise)}</strong><small>{data.metrics.paidOrderCount} paid orders · {formatPrice(data.metrics.averageOrderValuePaise)} average</small></article>
      </section>

      <section className="admin-section">
        <div className="admin-section-head"><div><p className="eyebrow">Configuration</p><h2>Production signals</h2></div></div>
        <div className="admin-signal-grid">
          <article><strong>Checkout</strong><StatusBadge value={data.settings?.checkout_enabled ? "enabled" : "disabled"} /><p>{data.settings?.flat_shipping_paise === null ? "Shipping amount is not configured." : "Shipping amount is configured."}</p></article>
          <article><strong>Supabase</strong><StatusBadge value={data.configuration.supabase ? "configured" : "missing"} /><p>Public and server configuration presence only; no credentials are displayed.</p></article>
          <article><strong>Razorpay</strong><StatusBadge value={data.configuration.razorpay ? "configured" : "missing"} /><p>Key and webhook-secret presence only; no credentials are displayed.</p></article>
          <article><strong>Catalogue attention</strong><StatusBadge value={data.inactiveCount ? "review" : "clear"} /><p>{data.inactiveCount} inactive product or variant records.</p></article>
        </div>
      </section>

      <div className="admin-two-column">
        <section className="admin-section">
          <div className="admin-section-head"><div><p className="eyebrow">Latest activity</p><h2>Recent orders</h2></div><Link href="/admin/orders">View all</Link></div>
          {data.recentOrders.length ? <div className="admin-list">{data.recentOrders.map((order) => <Link key={order.id} href={`/admin/orders/${order.order_number}`}><span><strong>{order.order_number}</strong><small>{order.customer_name} · {new Date(order.created_at).toLocaleString("en-IN")}</small></span><span><StatusBadge value={order.status} /><strong>{formatPrice(order.grand_total_paise)}</strong></span></Link>)}</div> : <EmptyAdminState title="No orders yet">New orders will appear here when real checkout activity begins.</EmptyAdminState>}
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><div><p className="eyebrow">Inventory</p><h2>Low stock</h2></div><Link href="/admin/inventory">Manage</Link></div>
          {data.settings?.low_stock_threshold === null || data.settings?.low_stock_threshold === undefined ? <EmptyAdminState title="Threshold not configured">Set a low-stock threshold before alerts are shown.</EmptyAdminState> : data.lowStock.length ? <div className="admin-list">{data.lowStock.map((variant) => <div key={variant.id}><span><strong>{relatedProductName(variant.products)}</strong><small>{variant.weight_grams} g</small></span><strong>{variant.stock_quantity}</strong></div>)}</div> : <EmptyAdminState title="No low-stock variants">Tracked variants are above the configured threshold.</EmptyAdminState>}
        </section>
      </div>
    </>
  );
}
