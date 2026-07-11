import Link from "next/link";

import { ProductCard } from "@/components/product/ProductCard";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export async function FeaturedProducts() {
  const products = await getPublicCatalogue();
  if (!products.length) return null;

  const featured = products.slice(0, 3);
  const heroImages = buildHeroImageMap(featured);

  return (
    <section className="section shell" aria-labelledby="featured-heading">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">From the catalogue</p>
          <h2 id="featured-heading">Explore the range</h2>
        </div>
        <Link className="text-link" href="/products">View all products <span>→</span></Link>
      </div>
      <div className="product-grid">
        {featured.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            heroSrc={heroImages[product.slug]}
          />
        ))}
      </div>
    </section>
  );
}
