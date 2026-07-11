import type { Metadata } from "next";
import Link from "next/link";

import { ProductsExplorer } from "@/components/product/ProductsExplorer";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse all 16 Sri Hari Suvai Instant Mix and Direct Mix products in four available weights.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Products | Sri Hari Suvai",
    description: "Browse all 16 Sri Hari Suvai Instant Mix and Direct Mix products.",
    url: "/products",
  },
};

export default async function ProductsPage() {
  const catalogue = await getPublicCatalogue();
  const heroImages = buildHeroImageMap(catalogue);

  return (
    <div className="page-wrap">
      <header className="page-hero page-hero--catalogue shell">
        <div>
          <p className="eyebrow">Product catalogue</p>
          <h1>Every mix, ready to discover.</h1>
        </div>
        <div className="page-hero-aside">
          <p>Explore 10 Instant Mix and 6 Direct Mix products, each available in four practical weights.</p>
          <Link className="button" href="/shop">Shop all products</Link>
        </div>
      </header>

      <section className="category-overview shell" aria-labelledby="category-overview-heading">
        <h2 className="visually-hidden" id="category-overview-heading">Product categories</h2>
        <a className="category-card" href="#instant-mix">
          <span>01</span><p className="eyebrow">10 products</p><h3>Instant Mix</h3><p>Convenient mixes for preparing familiar South Indian dishes.</p>
        </a>
        <a className="category-card category-card--dark" href="#direct-mix">
          <span>02</span><p className="eyebrow">6 products</p><h3>Direct Mix</h3><p>Versatile podis made to mix or serve with everyday favourites.</p>
        </a>
      </section>

      <section className="section catalogue-section shell" aria-label="Complete product catalogue">
        <ProductsExplorer products={catalogue} heroImages={heroImages} />
      </section>
    </div>
  );
}
