import Image from "next/image";
import Link from "next/link";

import { KitchenPicks } from "@/components/home/KitchenPicks";
import { RangeLinks } from "@/components/home/RangeLinks";
import { StoreIcon } from "@/components/ui/StoreIcon";
import { buildHeroImageMap, resolvePackIllustration } from "@/lib/assets";
import { products as illustratedProducts } from "@/lib/products";
import { getPublicCatalogue } from "@/lib/catalogue";

export default async function HomePage() {
  const products = await getPublicCatalogue();
  const images = buildHeroImageMap(products);
  const featured = new Map(["sambar-podi", "rasam-podi", "vathakkuzhambu-podi", "morkuzhambu-podi", "vendhya-kuzhambu-podi", "arisi-upma-mix"].map((slug, index) => [slug, index]));
  const ordered = [...products].sort((a, b) => (featured.get(a.slug) ?? featured.size) - (featured.get(b.slug) ?? featured.size));
  const picks = ordered.flatMap(product => {
    const pack = product.variants.find(variant => variant.available !== false);
    if (!pack) return [];
    const matchesLabel = images[product.slug] === "/images/products/" + product.slug + ".png" &&
      illustratedProducts.some(item => item.slug === product.slug && item.name === product.name && item.category === product.category);
    const packArt = matchesLabel ? resolvePackIllustration(product.slug) : null;
    return [{ slug: product.slug, name: product.name, category: product.category, image: packArt ?? images[product.slug], illustrated: Boolean(packArt), weight: pack.weightGrams, price: pack.pricePaise }];
  });

  return (
    <div className="home-store">
      <section className="kitchen-hero" aria-labelledby="hero-title">
        <picture>
          <source media="(orientation: portrait)" srcSet="/images/storefront/kitchen-hero-portrait.webp" />
          <Image className="kitchen-photo" src="/images/storefront/kitchen-hero-hd.webp" alt="Brass bowls of spice powder and a banana-leaf meal in a South Indian kitchen" fill unoptimized loading="eager" fetchPriority="high" />
        </picture>
        <div className="hero-inner store-shell">
          <div className="kitchen-hero-copy">
            <h1 id="hero-title">Authentic<br />South Indian Mixes<br />from Our Home Kitchen</h1>
            <span className="lotus-rule light-rule" aria-hidden="true" />
            <p>Traditional recipes <b>·</b> Pure ingredients <b>·</b> Made with care</p>
            <Link href="/shop" className="button hero-button">Shop Now <StoreIcon name="chevron-right" /></Link>
          </div>
        </div>
      </section>

      <section className="home-range" aria-labelledby="range-title">
        <div className="store-shell">
          <h2 className="ruled-title" id="range-title">Explore Our Range</h2>
          <span className="lotus-rule" aria-hidden="true" />
          <RangeLinks />
        </div>
      </section>
      <KitchenPicks items={picks} />

      <section className="home-story" aria-labelledby="story-title">
        <div className="story-image"><Image src="/images/storefront/grinding-spices.webp" alt="Grinding spices by hand with a stone mortar and pestle" fill unoptimized /></div>
        <div className="home-story-copy">
          <h2 id="story-title"><Link href="/about">The “Sri Hari Suvai” Story</Link></h2>
          <span className="lotus-rule" aria-hidden="true" />
          <p>There’s a place for podi at every South Indian table. From sambar simmering on the stove to a spoonful of spice folded into hot rice, our mixes bring the flavours of the home kitchen to everyday meals. <Link href="/about" className="story-link">Read our story</Link></p>
          <ul className="story-values" aria-label="Our kitchen traditions">
            <li><StoreIcon name="story-leaf" />Carefully chosen<br />spices</li>
            <li><StoreIcon name="story-mortar" />Traditional<br />recipes</li>
            <li><StoreIcon name="story-sprout" />Everyday<br />pantry staples</li>
            <li><StoreIcon name="story-rosette" />South Indian<br />flavours</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
