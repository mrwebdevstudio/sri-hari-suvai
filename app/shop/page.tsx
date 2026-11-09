import type { Metadata } from "next";
import Link from "next/link";
import { ShopExplorer } from "@/components/shop/ShopExplorer";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Sri Hari Suvai Instant Mix and Direct Mix products by pack size.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const [catalogue, params] = await Promise.all([getPublicCatalogue(), searchParams]);
  const category = params.range === "instant" ? "Instant Mix" : params.range === "direct" ? "Direct Mix" : "All";

  return (
    <div className="page-wrap">
      <header className={`pantry-heading shop-heading ${category === "Direct Mix" ? "shop-heading-direct" : ""}`}>
        <div className="store-shell">
          <p className="eyebrow">The Sri Hari Suvai shop</p><h1>{category === "All" ? "Shop the pantry" : category}</h1>
          <p>{category === "Direct Mix" ? "A spoonful of podi for rice, idli and dosa." : category === "Instant Mix" ? "Traditional mixes for the dishes you love to cook." : "South Indian mixes, from everyday rasam to a favourite rice podi."}</p>
          <Link href="/products" className="pantry-text-link">Browse product details →</Link>
        </div>
      </header>
      <section className="section section--first shell" aria-label="Shop products">
        <ShopExplorer category={category} products={catalogue} heroImages={buildHeroImageMap(catalogue)} />
      </section>
    </div>
  );
}
