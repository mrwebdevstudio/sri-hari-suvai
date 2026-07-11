import { adjustInventoryAction } from "@/app/admin/actions";
import { AdminNotice, AdminPageHeader, EmptyAdminState, StatusBadge } from "@/components/admin/AdminUi";
import { getInventoryData } from "@/lib/admin-data";

type Query = { message?: string; error?: string };

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [data, query] = await Promise.all([getInventoryData(), searchParams]);
  return (
    <>
      <AdminPageHeader eyebrow="Inventory operations" title="Inventory" description="Only variants with numeric tracking enabled appear here. Verified payment decrements are idempotent." />
      <AdminNotice message={query.message} error={query.error} />
      {data.threshold === null ? <p className="admin-notice">Low-stock threshold is not configured. Stock values are shown without low-stock claims.</p> : null}
      {data.variants.length ? <div className="admin-inventory-grid">{data.variants.map((variant) => {
        const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
        const state = variant.stock_quantity === 0 ? "out-of-stock" : data.threshold !== null && variant.stock_quantity <= data.threshold ? "low-stock" : "available";
        return <article className="admin-inventory-card" key={variant.id}><div className="admin-variant-head"><div><strong>{product?.name}</strong><small>{variant.weight_grams} g · {product?.slug}</small></div><StatusBadge value={state} /></div><div className="admin-stock-value"><span>Current quantity</span><strong>{variant.stock_quantity}</strong></div><form className="admin-form" action={adjustInventoryAction}><input type="hidden" name="variantId" value={variant.id} /><label>Adjustment delta<input name="delta" type="number" step="1" inputMode="numeric" placeholder="e.g. 10 or -2" required /></label><label>Reason<input name="reason" maxLength={500} required placeholder="Count correction, received stock…" /></label><button className="button button--small" type="submit">Apply adjustment</button></form></article>;
      })}</div> : <EmptyAdminState title="No tracked variants">Enable inventory tracking from a product’s variant editor. No stock quantities are assumed.</EmptyAdminState>}

      <section className="admin-section">
        <div className="admin-section-head"><div><p className="eyebrow">Append-only record</p><h2>Recent adjustments</h2></div></div>
        {data.adjustments.length ? <div className="admin-table-wrap"><table className="admin-table"><caption>Latest 25 stock adjustments</caption><thead><tr><th scope="col">Time</th><th scope="col">Variant</th><th scope="col">Before</th><th scope="col">Delta</th><th scope="col">After</th><th scope="col">Reason</th></tr></thead><tbody>{data.adjustments.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("en-IN")}</td><td>{item.product_variant_id}</td><td>{item.before_quantity}</td><td className="admin-number">{item.adjustment_delta > 0 ? "+" : ""}{item.adjustment_delta}</td><td>{item.after_quantity}</td><td>{item.reason}</td></tr>)}</tbody></table></div> : <p className="admin-help">No inventory adjustments have been recorded.</p>}
      </section>
    </>
  );
}
