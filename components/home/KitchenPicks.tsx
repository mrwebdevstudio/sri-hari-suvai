"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StoreIcon } from "@/components/ui/StoreIcon";
import { formatPrice, formatWeight } from "@/lib/currency";
import { productCategories, type ProductCategory } from "@/lib/products";

export type PantryPick = { slug: string; name: string; category: ProductCategory; image: string | null; illustrated: boolean; weight: number; price: number };

export function KitchenPicks({ items }: { items: PantryPick[] }) {
  const [category, setCategory] = useState<ProductCategory>("Instant Mix");
  const rail = useRef<HTMLUListElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const choices = productCategories.filter(group => items.some(item => item.category === group));
  const active = choices.includes(category) ? category : choices[0];
  const products = items.filter(item => item.category === active);

  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const track = rail.current;
    if (!track) return;
    const observer = new ResizeObserver(() => setScrollable(track.scrollWidth > track.clientWidth + 1));
    observer.observe(track);
    return () => observer.disconnect();
  }, [active, products.length]);

  function advance(direction: number) {
    const track = rail.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    const width = track.children[1] ? (track.children[1] as HTMLElement).offsetLeft - (track.children[0] as HTMLElement).offsetLeft : track.clientWidth;
    const next = direction > 0 && track.scrollLeft >= max - 2 ? 0 : direction < 0 && track.scrollLeft <= 2 ? max : track.scrollLeft + direction * width;
    track.scrollTo({ left: next, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  if (!products.length) return null;
  return (
    <section className="kitchen-picks store-shell" aria-labelledby="picks-title">
      <h2 className="ruled-title" id="picks-title">Our Kitchen Favourites</h2>
      <span className="lotus-rule" aria-hidden="true" />
      <div className="pick-filters" role="tablist" aria-label="Choose a range">
        {choices.map((group, index) => (
          <button key={group} ref={node => { tabs.current[index] = node; }} type="button" role="tab"
            id={`pick-tab-${index}`} aria-selected={active === group} aria-controls="pick-products" tabIndex={active === group ? 0 : -1}
            onClick={() => setCategory(group)}
            onKeyDown={event => {
              let next: number;
              switch (event.key) {
                case "ArrowRight": next = (index + 1) % choices.length; break;
                case "ArrowLeft": next = (index + choices.length - 1) % choices.length; break;
                case "Home": next = 0; break;
                case "End": next = choices.length - 1; break;
                default: return;
              }
              event.preventDefault();
              setCategory(choices[next]);
              tabs.current[next]?.focus();
            }}>{group}</button>
        ))}
      </div>
      <div className="pick-shelf" role="tabpanel" id="pick-products" aria-labelledby={`pick-tab-${choices.indexOf(active)}`}>
        {scrollable && <button className="shelf-arrow" type="button" aria-label="Previous products" onClick={() => advance(-1)}><StoreIcon name="chevron-left" /></button>}
        <ul ref={rail} key={active} aria-label={`${active} favourites`} tabIndex={0}>
          {products.map(item => (
            <li key={item.slug}><Link className="pantry-pick" href={"/products/" + item.slug}>
              <div className={item.illustrated ? "pick-photo pack-art" : "pick-photo"}>{item.image && <Image src={item.image} alt="" fill unoptimized={item.illustrated} sizes="(max-width: 560px) 43vw, (max-width: 900px) 27vw, 18vw" />}</div>
              <h3>{item.name}</h3><p><strong>{formatPrice(item.price)}</strong><span> / {formatWeight(item.weight)}</span></p>
            </Link></li>
          ))}
        </ul>
        {scrollable && <button className="shelf-arrow" type="button" aria-label="Next products" onClick={() => advance(1)}><StoreIcon name="chevron-right" /></button>}
      </div>
      {products.some(item => item.illustrated) && <p className="pack-caption">Pack images are illustrations.</p>}
    </section>
  );
}
