import type { Metadata } from "next";
import Link from "next/link";

import { ShopExplorer } from "@/components/shop/ShopExplorer";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop all Sri Hari Suvai Instant Mix and Direct Mix products by weight.",
  alternates: { canonical: "/shop" },
  openGraph: { title: "Shop | Sri Hari Suvai", description: "Choose a Sri Hari Suvai product and weight, then add it to your cart.", url: "/shop" },
};

export default async function ShopPage() {
  const catalogue = await getPublicCatalogue();
  return (
    <div className="page-wrap">
      <header className="shop-hero">
        <div className="shell shop-hero-inner">
          <div><p className="eyebrow">Sri Hari Suvai shop</p><h1>Choose your mix. Pick your weight.</h1></div>
          <div><p>All 16 products are available in 100g, 250g, 500g and 1000g. Build your cart with no login required.</p><Link className="text-link" href="/products">Continue shopping <span>→</span></Link></div>
        </div>
      </header>
      <section className="section section--first shell" aria-label="Shop all products">
        <ShopExplorer products={catalogue} heroImages={buildHeroImageMap(catalogue)} />
      </section>
    </div>
  );
}
