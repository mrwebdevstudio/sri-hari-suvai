import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { changeProductImageAction, updateProductAction, updateVariantAction } from "@/app/admin/actions";
import { resolveHeroPng } from "@/lib/assets";
import { AdminNotice, AdminPageHeader, StatusBadge } from "@/components/admin/AdminUi";
import { formatPaiseAsRupees } from "@/lib/admin";
import { getAdminProduct } from "@/lib/admin-data";
import { productCategories } from "@/lib/products";

type Query = { message?: string; error?: string };

export default async function AdminProductDetailPage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<Query> }) {
  const [{ productId }, query] = await Promise.all([params, searchParams]);
  const product = await getAdminProduct(productId);
  if (!product) notFound();
  const variants = [...(product.product_variants || [])].sort((a, b) => a.weight_grams - b.weight_grams);
  return (
    <>
      <AdminPageHeader eyebrow="Product management" title={product.name} description={product.slug} actions={<Link href="/admin/products">Back to products</Link>} />
      <AdminNotice message={query.message} error={query.error} />
      <div className="admin-product-edit-grid">
        <aside className="admin-product-preview">{(product.product_images || product.image_path || resolveHeroPng(product.slug)) && <Image src={product.product_images ? "/api/admin/product-images/"+product.id : product.image_path || `/images/products/${product.slug}.png`} unoptimized={Boolean(product.product_images)} alt={product.image_alt || product.name} width={360} height={450} sizes="(max-width: 800px) 100vw, 320px" />}<StatusBadge value={product.active ? "active" : "inactive"} />
          <form className="admin-form" action={changeProductImageAction}>
            <input type="hidden" name="id" value={product.id} />
            <label>Product image (up to 4 MB)<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required /></label>
            <button type="submit" className="button">Upload image</button>
            {product.product_images && <button type="submit" name="operation" value="remove" formNoValidate>Remove uploaded image</button>}
          </form>
        </aside>
        <section className="admin-section">
          <div className="admin-section-head"><div><p className="eyebrow">Verified content</p><h2>Product details</h2></div></div>
          <form className="admin-form" action={updateProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <label>Display name<input name="name" defaultValue={product.name} required maxLength={150} /></label>
            <label>Slug<input value={product.slug} readOnly aria-readonly="true" /><span>Permanent URL key; kept read-only to protect catalogue links.</span></label>
            <label>Category<select name="category" defaultValue={product.category}>{productCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Short description<textarea name="summary" defaultValue={product.summary} maxLength={1000} /></label>
            <label>Usage note<textarea name="usage" defaultValue={product.usage} maxLength={1000} /></label>
            <label>Controlled image path<input name="imagePath" defaultValue={product.image_path || ""} placeholder={`/images/products/${product.slug}.png`} /><span>Only local paths under /images/products/ are accepted.</span></label>
            <label>Sort order<input name="sortOrder" type="number" min="0" step="1" defaultValue={product.sort_order} required /></label>
            <label className="admin-check"><input name="active" type="checkbox" defaultChecked={product.active} /><span>Active on the storefront</span></label>
            <button className="button" type="submit">Save product</button>
          </form>
        </section>
      </div>

      <section className="admin-section">
        <div className="admin-section-head"><div><p className="eyebrow">Pricing and availability</p><h2>{variants.length} variants</h2></div></div>
        <p className="admin-help">Prices persist in integer paise. Stock changes require a reason and historical order prices remain unchanged.</p>
        <div className="admin-variant-grid">{variants.map((variant) => <form className="admin-variant-card" action={updateVariantAction} key={variant.id}>
          <input type="hidden" name="id" value={variant.id} /><input type="hidden" name="productId" value={product.id} />
          <div className="admin-variant-head"><div><strong>{variant.weight_grams} g</strong><small>Updated {new Date(variant.updated_at).toLocaleString("en-IN")}</small></div><StatusBadge value={variant.active ? "active" : "inactive"} /></div>
          <label>Weight (g)<input name="weightGrams" type="number" min="1" step="1" defaultValue={variant.weight_grams} required /></label>
          <label>Price (₹)<input name="priceRupees" inputMode="decimal" defaultValue={formatPaiseAsRupees(variant.price_paise)} required /></label>
          <label className="admin-check"><input name="active" type="checkbox" defaultChecked={variant.active} /><span>Variant active</span></label>
          {variant.active ? <label className="admin-check admin-confirm"><input name="confirmDeactivate" type="checkbox" /><span>Confirm if deactivating this variant</span></label> : null}
          <label className="admin-check"><input name="trackInventory" type="checkbox" defaultChecked={variant.track_inventory} /><span>Track numeric inventory</span></label>
          <label>Stock quantity<input name="stockQuantity" type="number" min="0" step="1" defaultValue={variant.stock_quantity ?? ""} /><span>Leave unused when tracking is off.</span></label>
          <label>Adjustment reason<input name="reason" maxLength={500} placeholder="Required when stock/tracking changes" /></label>
          <button className="button button--small" type="submit">Save variant</button>
        </form>)}</div>
      </section>
    </>
  );
}
