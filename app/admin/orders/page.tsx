import Link from "next/link";

import { AdminNotice, AdminPageHeader, EmptyAdminState, StatusBadge } from "@/components/admin/AdminUi";
import { ADMIN_PAGE_SIZE, getAdminOrders } from "@/lib/admin-data";
import { formatPrice } from "@/lib/currency";
import { orderStatuses, paymentStatuses } from "@/lib/orders";

type Query = { q?: string; payment?: string; status?: string; from?: string; to?: string; page?: string; message?: string; error?: string };

function pageHref(query: Query, page: number) {
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(query)) if (item && key !== "page" && key !== "message" && key !== "error") params.set(key, item);
  params.set("page", String(page));
  return `/admin/orders?${params}`;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const result = await getAdminOrders({
    query: query.q,
    payment: paymentStatuses.includes(query.payment as (typeof paymentStatuses)[number]) ? query.payment : undefined,
    status: orderStatuses.includes(query.status as (typeof orderStatuses)[number]) ? query.status : undefined,
    from: query.from,
    to: query.to,
    page: Math.max(1, Number(query.page) || 1),
  });
  return (
    <>
      <AdminPageHeader eyebrow="Order operations" title="Orders" description="Search and filter without loading the complete order history into the browser." />
      <AdminNotice message={query.message} error={query.error} />
      <form className="admin-filter" method="get">
        <label className="admin-filter-search">Search orders<input name="q" type="search" defaultValue={query.q} placeholder="Order number, customer, phone or email" /></label>
        <label>Payment<select name="payment" defaultValue={query.payment || ""}><option value="">All</option>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Fulfilment<select name="status" defaultValue={query.status || ""}><option value="">All</option>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>From<input name="from" type="date" defaultValue={query.from} /></label>
        <label>To<input name="to" type="date" defaultValue={query.to} /></label>
        <div className="admin-filter-actions"><button className="button button--small" type="submit">Apply filters</button><Link href="/admin/orders">Clear</Link></div>
      </form>

      {result.orders.length ? (
        <section className="admin-table-wrap" aria-labelledby="orders-table-heading">
          <h2 className="visually-hidden" id="orders-table-heading">Filtered orders</h2>
          <table className="admin-table"><caption>{result.total} orders · showing up to {ADMIN_PAGE_SIZE} per page</caption><thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Payment</th><th scope="col">Fulfilment</th><th scope="col">Total</th><th scope="col"><span className="visually-hidden">Open</span></th></tr></thead><tbody>
            {result.orders.map((order) => <tr key={order.id}><th scope="row"><Link href={`/admin/orders/${order.order_number}`}>{order.order_number}</Link></th><td>{order.customer_name}<small>{order.phone}</small></td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td><td>{order.order_items?.[0]?.count || 0}</td><td><StatusBadge value={order.payment_status} /></td><td><StatusBadge value={order.status} /></td><td className="admin-number">{formatPrice(order.grand_total_paise)}</td><td><Link className="admin-row-link" href={`/admin/orders/${order.order_number}`}>Open</Link></td></tr>)}
          </tbody></table>
        </section>
      ) : <EmptyAdminState title="No orders match">Clear or broaden the filters to find another order.</EmptyAdminState>}

      {result.pageCount > 1 ? <nav className="admin-pagination" aria-label="Order pages"><Link aria-disabled={result.page <= 1} href={result.page <= 1 ? pageHref(query, 1) : pageHref(query, result.page - 1)}>Previous</Link><span>Page {result.page} of {result.pageCount}</span><Link aria-disabled={result.page >= result.pageCount} href={result.page >= result.pageCount ? pageHref(query, result.pageCount) : pageHref(query, result.page + 1)}>Next</Link></nav> : null}
    </>
  );
}
