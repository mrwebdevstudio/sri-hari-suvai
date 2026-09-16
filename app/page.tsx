import { getImageProps } from "next/image";
import Link from "next/link";

import { HomepageSectionScroller } from "@/components/home/HomepageSectionScroller";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { ProductSpotlight } from "@/components/sections/ProductSpotlight";
import { buildHeroImageMap } from "@/lib/assets";
import { getPublicCatalogue } from "@/lib/catalogue";

export default async function HomePage() {
  const products = await getPublicCatalogue();
  const spotlight = products.find((product) => product.slug === "idly-podi") ?? products[0];
  const spotlightImage = spotlight ? buildHeroImageMap([spotlight])[spotlight.slug] : null;
  const imageAlt = "A bowl of roasted spice powder in a warm South Indian culinary setting";
  const { props: desktopHero } = getImageProps({
    src: "/images/generated/home-hero-desktop.webp",
    alt: imageAlt,
    width: 1568,
    height: 1003,
    sizes: "100vw",
    priority: true,
  });
  const { props: mobileHero } = getImageProps({
    src: "/images/generated/home-hero-mobile.webp",
    alt: imageAlt,
    width: 1003,
    height: 1568,
    sizes: "100vw",
    priority: true,
  });

  return (
    <HomepageSectionScroller>
      <section className="homepage-section home-hero" data-home-section aria-labelledby="hero-heading">
        <picture className="hero-picture">
          <source media="(max-width: 640px)" srcSet={mobileHero.srcSet} />
          <img {...desktopHero} alt={imageAlt} className="hero-image" />
        </picture>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-content shell">
          <p className="eyebrow hero-eyebrow">South Indian food products</p>
          <h1 id="hero-heading">Flavour, presented with quiet confidence.</h1>
          <p className="hero-copy">
            Shop South Indian podis and mixes with clear prices, pack sizes and a direct path to your cart.
          </p>
          <div className="button-row">
            <Link className="button" href="/shop">Shop products</Link>
          </div>
        </div>
      </section>

      <FeaturedProducts products={products} />
      {spotlight ? <ProductSpotlight product={spotlight} imageSrc={spotlightImage} /> : null}

      <section className="homepage-section closing-cta home-closing-cta" data-home-section aria-labelledby="closing-heading">
        <div className="shell closing-cta-inner">
          <div>
            <h2 id="closing-heading">Find the right mix for your table.</h2>
            <p>Browse every product, compare pack sizes and choose what belongs in your kitchen.</p>
          </div>
          <Link className="button button--light" href="/shop">Shop the complete range</Link>
        </div>
      </section>
    </HomepageSectionScroller>
  );
}
