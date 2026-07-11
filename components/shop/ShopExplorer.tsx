"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import type { HeroImageMap } from "@/lib/assets";
import { formatPrice, formatWeight } from "@/lib/currency";
import { getStartingPricePaise, productCategories, type Product, type ProductCategory } from "@/lib/products";

type CategoryFilter = "All" | ProductCategory;

export function ShopExplorer({ products, heroImages }: { products: readonly Product[]; heroImages: HeroImageMap }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [maxPricePaise, setMaxPricePaise] = useState(0);
  const { itemCount, subtotalPaise } = useCart();

  const visibleProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesQuery = !search || [product.name, product.category, product.usage].some((value) => value.toLocaleLowerCase().includes(search));
      const matchesCategory = category === "All" || product.category === category;
      const matchesPrice = !maxPricePaise || getStartingPricePaise(product) <= maxPricePaise;
      return matchesQuery && matchesCategory && matchesPrice;
    });
  }, [category, maxPricePaise, products, query]);

  return (
    <div className="shop-explorer">
      <div className="shop-toolbar" aria-label="Shop filters">
        <div className="shop-search">
          <label htmlFor="shop-search">Search products</label>
          <input id="shop-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the catalogue" />
        </div>
        <div className="shop-price-filter">
          <label htmlFor="shop-price-filter">Starting price</label>
          <select id="shop-price-filter" value={maxPricePaise} onChange={(event) => setMaxPricePaise(Number(event.target.value))}>
            <option value={0}>Any price</option>
            <option value={10000}>Up to ₹100</option>
            <option value={20000}>Up to ₹200</option>
            <option value={40000}>Up to ₹400</option>
          </select>
        </div>
        <div className="category-filter" aria-label="Filter by category">
          {(["All", ...productCategories] as const).map((option) => (
            <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>{option}</button>
          ))}
        </div>
      </div>

      <p className="result-count" role="status" aria-live="polite">
        <span key={`${category}-${query}-${maxPricePaise}-${visibleProducts.length}`}>{visibleProducts.length} products shown</span>
      </p>

      <Link className="sticky-cart-shortcut" href="/cart" aria-label={`Open cart with ${itemCount} ${itemCount === 1 ? "item" : "items"}`}>
        <span>Cart · {itemCount} {itemCount === 1 ? "item" : "items"}</span>
        <strong>{formatPrice(subtotalPaise)}</strong>
      </Link>

      {visibleProducts.length ? (
        <div className="shop-grid" key={`${category}-${query}-${maxPricePaise}`}>
          {visibleProducts.map((product, index) => (
            <ShopProductCard key={product.slug} product={product} heroSrc={heroImages[product.slug]} eager={index === 0} />
          ))}
        </div>
      ) : (
        <div className="empty-state" role="status">
          <h2>No products match these filters.</h2>
          <button className="text-button" type="button" onClick={() => { setQuery(""); setCategory("All"); setMaxPricePaise(0); }}>Clear filters</button>
        </div>
      )}
    </div>
  );
}

function ShopProductCard({ product, heroSrc, eager }: { product: Product; heroSrc?: string | null; eager?: boolean }) {
  const id = useId();
  const [weightGrams, setWeightGrams] = useState(product.variants[0].weightGrams);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const variant = product.variants.find((entry) => entry.weightGrams === weightGrams) ?? product.variants[0];

  return (
    <article className="shop-product-card" id={product.slug}>
      <Link className="shop-product-image" href={`/products/${product.slug}`}>
        {heroSrc ? <Image src={heroSrc} alt={product.imageAlt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" loading={eager ? "eager" : "lazy"} /> : null}
      </Link>
      <div className="shop-product-body">
        <p className="eyebrow">{product.category}</p>
        <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
        <p>{product.usage}</p>
        <label htmlFor={id}>Choose weight</label>
        <select id={id} value={weightGrams} onChange={(event) => { setWeightGrams(Number(event.target.value) as typeof weightGrams); setAdded(false); }}>
          {product.variants.map((entry) => <option key={entry.weightGrams} value={entry.weightGrams}>{formatWeight(entry.weightGrams)} — {formatPrice(entry.pricePaise)}</option>)}
        </select>
        <div className="shop-product-action">
          <strong className="motion-price" key={variant.weightGrams}>{formatPrice(variant.pricePaise)}</strong>
          <button className="button button--small" data-added={added || undefined} type="button" onClick={() => { addItem(product.slug, variant.weightGrams); setAdded(true); }}>{added ? "Added" : "Add to cart"}</button>
        </div>
        <p className="purchase-status" role="status">{added ? `${formatWeight(variant.weightGrams)} added.` : ""}</p>
      </div>
    </article>
  );
}
