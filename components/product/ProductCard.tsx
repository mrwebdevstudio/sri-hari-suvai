import Image from "next/image";
import Link from "next/link";

import { AnimatedImagePlaceholder } from "@/components/ui/AnimatedImagePlaceholder";
import { formatPrice, formatWeight } from "@/lib/currency";
import { getStartingPricePaise, type Product } from "@/lib/products";

type ProductCardProps = {
  product: Product;
  heroSrc?: string | null;
  showVariants?: boolean;
  shopLabel?: string;
};

export function ProductCard({
  product,
  heroSrc,
  showVariants = false,
  shopLabel = "Shop this product",
}: ProductCardProps) {
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
          {showVariants ? (
            <p className="product-card-variants">
              {product.variants.map((variant) => formatWeight(variant.weightGrams)).join(", ")}
            </p>
          ) : null}
          <p className="product-card-price">From {formatPrice(getStartingPricePaise(product))}</p>
          <span className="text-link" aria-hidden="true">View details <span>→</span></span>
        </div>
      </Link>
      <Link className="product-card-shop" href={"/shop#" + product.slug}>
        {shopLabel}
      </Link>
    </article>
  );
}
