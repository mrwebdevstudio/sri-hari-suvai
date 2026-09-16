import Image from "next/image";
import Link from "next/link";

import { AnimatedImagePlaceholder } from "@/components/ui/AnimatedImagePlaceholder";
import { formatPrice, formatWeight } from "@/lib/currency";
import { getStartingPricePaise, type Product } from "@/lib/products";

type ProductSpotlightProps = {
  product: Product;
  imageSrc?: string | null;
};

export function ProductSpotlight({ product, imageSrc }: ProductSpotlightProps) {
  return (
    <section className="homepage-section product-spotlight" data-home-section aria-labelledby="spotlight-heading">
      <div className="shell product-spotlight-grid">
        <div className="product-spotlight-media">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.imageAlt}
              fill
              sizes="(max-width: 820px) 100vw, 48vw"
            />
          ) : (
            <AnimatedImagePlaceholder
              label={"Product image unavailable for " + product.name}
              animated={false}
            />
          )}
        </div>
        <div className="product-spotlight-copy">
          <h2 id="spotlight-heading">{product.name}</h2>
          <p className="lead">{product.summary}</p>
          <dl className="product-spotlight-details">
            <div>
              <dt>Starting at</dt>
              <dd>{formatPrice(getStartingPricePaise(product))}</dd>
            </div>
            <div>
              <dt>Pack sizes</dt>
              <dd>{product.variants.map((variant) => formatWeight(variant.weightGrams)).join(", ")}</dd>
            </div>
          </dl>
          <Link className="button" href={"/shop#" + product.slug}>Choose options</Link>
        </div>
      </div>
    </section>
  );
}
