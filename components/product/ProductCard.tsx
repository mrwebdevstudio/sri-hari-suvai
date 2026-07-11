import Image from "next/image";
import Link from "next/link";

import { AnimatedImagePlaceholder } from "@/components/ui/AnimatedImagePlaceholder";
import { formatPrice } from "@/lib/currency";
import { getStartingPricePaise, type Product } from "@/lib/products";

type ProductCardProps = {
  product: Product;
  heroSrc?: string | null;
};

export function ProductCard({ product, heroSrc }: ProductCardProps) {
  return (
    <article className="product-card">
      <Link className="product-card-link" href={"/products/" + product.slug}>
        <div className="product-card-media">
          {heroSrc ? (
            <Image
              src={heroSrc}
              alt={product.imageAlt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <AnimatedImagePlaceholder
              label={"Product image unavailable for " + product.name}
              animated={false}
            />
          )}
        </div>
        <div className="product-card-body">
          <p className="eyebrow">{product.category}</p>
          <h2>{product.name}</h2>
          <p>{product.usage}</p>
          <p className="product-card-price">From {formatPrice(getStartingPricePaise(product))}</p>
          <span className="text-link" aria-hidden="true">View product <span>→</span></span>
        </div>
      </Link>
      <Link className="product-card-shop" href={"/shop#" + product.slug}>
        Shop this product
      </Link>
    </article>
  );
}
