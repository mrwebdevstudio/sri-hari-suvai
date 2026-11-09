import type { Metadata } from "next";
import { ProductsExplorer } from "@/components/product/ProductsExplorer";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse Sri Hari Suvai Instant Mix and Direct Mix products and choose your pack size.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [catalogue, params] = await Promise.all([getPublicCatalogue(), searchParams]);
  const query = typeof params.q === "string" ? params.q : "";
  return (
    <div className="page-wrap">
      <header className="pantry-heading"><div className="store-shell">
        <p className="eyebrow">Sri Hari Suvai</p><h1>Our spice pantry</h1>
        <p>Explore the podis and mixes behind your favourite South Indian meals.</p>
      </div></header>
      <section className="section section--first shell" aria-label="Complete product catalogue">
        <ProductsExplorer key={query} initialQuery={query} products={catalogue} heroImages={buildHeroImageMap(catalogue)} />
      </section>
    </div>
  );
}
