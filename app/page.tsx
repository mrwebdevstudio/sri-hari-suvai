import { getImageProps } from "next/image";
import Link from "next/link";

import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { ProductJourneyScroller } from "@/components/sections/ProductJourneyScroller";
import { siteConfig } from "@/lib/site";

export default function HomePage() {
  const hasContact = Boolean(siteConfig.whatsappNumber || siteConfig.email);
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
    <>
      <section className="home-hero" aria-labelledby="hero-heading">
        <picture className="hero-picture">
          <source media="(max-width: 640px)" srcSet={mobileHero.srcSet} />
          <img {...desktopHero} alt={imageAlt} className="hero-image" />
        </picture>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-content shell">
          <p className="eyebrow hero-eyebrow">South Indian food products</p>
          <h1 id="hero-heading">Flavour, presented with quiet confidence.</h1>
          <p className="hero-copy">
            Discover the Sri Hari Suvai catalogue through clear product detail,
            thoughtful imagery and a direct path to enquiry.
          </p>
          <div className="button-row">
            <Link className="button" href="/products">Explore products</Link>
            {hasContact ? (
              <Link className="button button--secondary" href="/contact">Make an enquiry</Link>
            ) : null}
          </div>
        </div>
        <a className="hero-scroll" href="#introduction">Discover <span aria-hidden="true">↓</span></a>
      </section>

      <section id="introduction" className="introduction section shell" aria-labelledby="intro-heading">
        <p className="eyebrow">Sri Hari Suvai</p>
        <div className="intro-grid">
          <h2 id="intro-heading">A focused home for South Indian food products.</h2>
          <div>
            <p className="lead">
              The catalogue is designed to make each product easy to understand—what it is,
              what is known about it, and how to enquire.
            </p>
            <p>
              Product facts, pack information and contact options appear only when approved,
              keeping the experience useful without filling gaps with assumptions.
            </p>
          </div>
        </div>
      </section>

      <FeaturedProducts />
      <ProductJourneyScroller />

      <section className="principles section shell" aria-labelledby="principles-heading">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Made to be understood</p>
          <h2 id="principles-heading">Simple choices. Honest detail.</h2>
        </div>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>Products stay central</h3>
            <p>Each page is structured around the product name, image and useful approved details.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Unknowns stay out</h3>
            <p>Unsupported claims, prices, certifications and policies are deliberately omitted.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Enquiries stay direct</h3>
            <p>A configured email or WhatsApp channel becomes the single clear conversion path.</p>
          </article>
        </div>
      </section>

      <section className="closing-cta" aria-labelledby="closing-heading">
        <div className="shell closing-cta-inner">
          <div>
            <p className="eyebrow">Continue exploring</p>
            <h2 id="closing-heading">See the complete product catalogue.</h2>
          </div>
          <Link className="button button--light" href="/products">Explore products</Link>
        </div>
      </section>
    </>
  );
}
