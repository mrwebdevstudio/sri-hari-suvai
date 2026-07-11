import Image from "next/image";
import Link from "next/link";

import { AdminPageHeader, EmptyAdminState, StatusBadge } from "@/components/admin/AdminUi";
import { getAdminProducts } from "@/lib/admin-data";
import { formatPrice } from "@/lib/currency";
import { productCategories } from "@/lib/products";

type Query = { q?: string; category?: string; active?: string };
type AdminVariant = { price_paise: number; track_inventory: boolean };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const products = await getAdminProducts();
  const search = (query.q || "").trim().toLocaleLowerCase();
  const filtered = products.filter((product) => {
    const matchesSearch = !search || [product.name, product.slug].some((item) => String(item).toLocaleLowerCase().includes(search));
    const matchesCategory = !query.category || product.category === query.category;
    const matchesActive = !query.active || String(product.active) === query.active;
    return matchesSearch && matchesCategory && matchesActive;
  });
  return (
    <>
      <AdminPageHeader eyebrow="Catalogue operations" title="Products" description={`${products.length} product records. Historical order snapshots are never rewritten by catalogue edits.`} />
      <form className="admin-filter" method="get">
        <label className="admin-filter-search">Search products<input name="q" type="search" defaultValue={query.q} placeholder="Product name or slug" /></label>
        <label>Category<select name="category" defaultValue={query.category || ""}><option value="">All</option>{productCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>State<select name="active" defaultValue={query.active || ""}><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <div className="admin-filter-actions"><button className="button button--small" type="submit">Apply filters</button><Link href="/admin/products">Clear</Link></div>
      </form>
      {filtered.length ? <div className="admin-product-list">{filtered.map((product) => {
        const variants = (product.product_variants || []) as AdminVariant[];
        const prices = variants.map((variant) => variant.price_paise);
        const tracked = variants.filter((variant) => variant.track_inventory);
        return <Link key={product.id} href={`/admin/products/${product.id}`} className="admin-product-row">
          <Image src={product.image_path || `/images/products/${product.slug}.png`} alt="" width={56} height={70} sizes="56px" />
          <span className="admin-product-name"><strong>{product.name}</strong><small>{product.slug}</small></span>
          <span>{product.category}</span><span>{variants.length} variants</span><span>{prices.length ? `${formatPrice(Math.min(...prices))}–${formatPrice(Math.max(...prices))}` : "No price"}</span>
          <span>{tracked.length ? `${tracked.length} tracked` : "Not tracked"}</span><StatusBadge value={product.active ? "active" : "inactive"} />
        </Link>;
      })}</div> : <EmptyAdminState title="No products match">Clear the filters to return to the complete 16-product catalogue.</EmptyAdminState>}
    </>
  );
}
