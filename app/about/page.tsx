import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RangeLinks } from "@/components/home/RangeLinks";

export const metadata: Metadata = {
  title: "Our Story",
  description: "Discover the South Indian kitchen traditions behind Sri Hari Suvai’s podis and mixes.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="about-store">
      <div className="story-spread store-shell">
        <div className="story-portrait"><Image src="/images/storefront/grinding-spices.webp" alt="A stone mortar, whole spices and brass bowls in the kitchen" fill sizes="(max-width: 700px) 100vw, 50vw" preload /></div>
        <div className="story-editorial">
          <p className="eyebrow">Our story</p><h1>The Sri Hari Suvai kitchen</h1>
          <span className="lotus-rule" aria-hidden="true" />
          <p>In a South Indian kitchen, a small spoonful of podi can shape a whole meal. It gives rasam its warmth, brings depth to sambar, and turns a plate of hot rice into lunch.</p>
          <p>Sri Hari Suvai brings those flavours together in two ranges. Our Instant Mix range helps you prepare familiar dishes. Our Direct Mix podis go straight onto rice or alongside favourites like idli and dosa.</p>
          <Link className="button" href="/shop">Shop the pantry</Link>
        </div>
      </div>
      <section className="store-shell about-ranges"><h2 className="ruled-title">Explore Our Range</h2><RangeLinks /></section>
    </article>
  );
}
