import Link from "next/link";

import { ProductCard } from "@/components/product/ProductCard";
import { buildHeroImageMap } from "@/lib/assets";
import type { Product } from "@/lib/products";

export function FeaturedProducts({ products }: { products: readonly Product[] }) {
  if (!products.length) return null;

  const featured = products.slice(0, 3);
  const heroImages = buildHeroImageMap(featured);

  return (
    <section
      id="introduction"
      className="homepage-section home-products-section"
      data-home-section
      aria-labelledby="featured-heading"
    >
      <div className="shell">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">From the catalogue</p>
            <h2 id="featured-heading">Explore the range</h2>
          </div>
          <Link className="text-link" href="/products">View all products <span>→</span></Link>
        </div>
        <div className="product-grid home-product-grid">
          {featured.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              heroSrc={heroImages[product.slug]}
              showVariants
              shopLabel="Choose options"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
