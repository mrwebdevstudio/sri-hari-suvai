import { AdminPageHeader, EmptyAdminState } from "@/components/admin/AdminUi";
import { getAnalyticsData } from "@/lib/admin-data";
import { formatPrice } from "@/lib/currency";

type Query = { range?: string; from?: string; to?: string };

function rangeDates(query: Query) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  if (query.range === "7") start.setDate(start.getDate() - 6);
  else if (query.range === "month") start.setDate(1);
  else if (query.range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(query.from || "") && /^\d{4}-\d{2}-\d{2}$/.test(query.to || "")) {
    const customStart = new Date(`${query.from}T00:00:00.000Z`);
    const customEnd = new Date(`${query.to}T23:59:59.999Z`);
    if (customStart <= customEnd && customEnd.valueOf() - customStart.valueOf() <= 366 * 86_400_000) return { start: customStart, end: customEnd, range: "custom" };
  } else start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end, range: query.range || "30" };
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const dates = rangeDates(query);
  const data = await getAnalyticsData(dates.start.toISOString(), dates.end.toISOString());
  const maxRevenue = Math.max(...data.byDay.map((row) => row.revenuePaise), 1);
  return (
    <>
      <AdminPageHeader eyebrow="Verified commerce data" title="Analytics" description={`From ${dates.start.toLocaleDateString("en-IN")} to ${dates.end.toLocaleDateString("en-IN")}. Revenue includes only verified paid orders and subtracts recorded refunds.`} />
      <form className="admin-filter" method="get">
        <label>Range<select name="range" defaultValue={dates.range}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="month">Current month</option><option value="custom">Custom range</option></select></label>
        <label>Custom from<input name="from" type="date" defaultValue={query.from} /></label><label>Custom to<input name="to" type="date" defaultValue={query.to} /></label><div className="admin-filter-actions"><button className="button button--small" type="submit">Update range</button></div>
      </form>
      <section className="admin-metric-grid" aria-label="Revenue summary"><article><span>Gross verified revenue</span><strong>{formatPrice(data.revenue.grossPaise)}</strong></article><article><span>Refunds</span><strong>{formatPrice(data.revenue.refundedPaise)}</strong></article><article><span>Net revenue</span><strong>{formatPrice(data.revenue.netPaise)}</strong></article><article><span>Average order value</span><strong>{formatPrice(data.revenue.averageOrderValuePaise)}</strong></article><article><span>Total orders</span><strong>{data.totalOrders}</strong></article><article><span>Failed payments</span><strong>{data.failedPayments}</strong></article><article><span>Shipping collected</span><strong>{formatPrice(data.shippingCollectedPaise)}</strong></article><article><span>Guest / account orders</span><strong>{data.guestOrders} / {data.authenticatedOrders}</strong></article></section>

      {data.byDay.length ? <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Daily operations</p><h2>Net revenue by day</h2></div></div><div className="admin-bars" role="img" aria-label="Daily net revenue bar chart">{data.byDay.map((row) => <div key={row.date}><span>{new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><i style={{ "--bar-size": `${Math.max(2, Math.round(row.revenuePaise / maxRevenue * 100))}%` } as React.CSSProperties} /><strong>{formatPrice(row.revenuePaise)}</strong></div>)}</div><div className="admin-table-wrap"><table className="admin-table"><caption>Accessible daily revenue and order-count data</caption><thead><tr><th scope="col">Date</th><th scope="col">Orders</th><th scope="col">Net revenue</th></tr></thead><tbody>{data.byDay.map((row) => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.orders}</td><td>{formatPrice(row.revenuePaise)}</td></tr>)}</tbody></table></div></section> : <EmptyAdminState title="No orders in this range">Choose another date range after real orders have been recorded.</EmptyAdminState>}

      <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Monthly summary</p><h2>Net revenue by month</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><caption>Monthly verified net revenue and order count</caption><thead><tr><th scope="col">Month</th><th scope="col">Orders</th><th scope="col">Net revenue</th></tr></thead><tbody>{data.byMonth.map((row) => <tr key={row.month}><th scope="row">{row.month}</th><td>{row.orders}</td><td>{formatPrice(row.revenuePaise)}</td></tr>)}</tbody></table></div></section>

      <div className="admin-two-column"><section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Products</p><h2>Units and revenue</h2></div></div>{data.products.length ? <div className="admin-table-wrap"><table className="admin-table"><caption>Verified paid product performance</caption><thead><tr><th scope="col">Product</th><th scope="col">Units</th><th scope="col">Revenue</th></tr></thead><tbody>{data.products.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.units}</td><td>{formatPrice(row.revenuePaise)}</td></tr>)}</tbody></table></div> : <p className="admin-help">No verified paid product data.</p>}</section>
      <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Fulfilment</p><h2>Status distribution</h2></div></div>{data.fulfilment.length ? <div className="admin-list">{data.fulfilment.map((row) => <div key={row.status}><span>{row.status.replaceAll("_", " ")}</span><strong>{row.count}</strong></div>)}</div> : <p className="admin-help">No fulfilment data.</p>}<h3>Variant weight</h3><div className="admin-list">{data.variants.slice(0, 8).map((row) => <div key={row.name}><span>{row.name} · {row.units} units</span><strong>{formatPrice(row.revenuePaise)}</strong></div>)}</div></section></div>
    </>
  );
}
