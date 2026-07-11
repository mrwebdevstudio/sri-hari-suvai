"use client";

import { useMemo, useState } from "react";

import { ProductCard } from "@/components/product/ProductCard";
import type { HeroImageMap } from "@/lib/assets";
import { productCategories, type Product, type ProductCategory } from "@/lib/products";

type CategoryFilter = "All" | ProductCategory;

export function ProductsExplorer({ products, heroImages }: { products: readonly Product[]; heroImages: HeroImageMap }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesQuery = !normalizedQuery || [product.name, product.usage, product.category].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesQuery;
    });
  }, [category, products, query]);

  const visibleCategories = productCategories.filter(
    (productCategory) => category === "All" || category === productCategory,
  );

  return (
    <div>
      <div className="catalogue-toolbar">
        <div className="search-field">
          <label htmlFor="product-search">Search products</label>
          <input id="product-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or category" />
        </div>
        <div className="category-filter" aria-label="Filter products by category">
          {(["All", ...productCategories] as const).map((option) => (
            <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>{option}</button>
          ))}
        </div>
      </div>

      <p className="result-count" role="status" aria-live="polite">
        <span key={`${category}-${query}-${visibleProducts.length}`}>{visibleProducts.length} products shown</span>
      </p>

      {visibleProducts.length ? visibleCategories.map((productCategory) => {
        const categoryProducts = visibleProducts.filter((product) => product.category === productCategory);
        if (!categoryProducts.length) return null;
        return (
          <section className="catalogue-group" id={productCategory.toLocaleLowerCase().replace(" ", "-")} key={`${category}-${query}-${productCategory}`} aria-labelledby={`${productCategory}-heading`}>
            <div className="catalogue-group-heading">
              <p className="eyebrow">{productCategory}</p>
              <h2 id={`${productCategory}-heading`}>{categoryProducts.length} products</h2>
            </div>
            <div className="product-grid">
              {categoryProducts.map((product) => <ProductCard key={product.slug} product={product} heroSrc={heroImages[product.slug]} />)}
            </div>
          </section>
        );
      }) : (
        <div className="empty-state" role="status">
          <h2>No products match “{query}”.</h2>
          <button className="text-button" type="button" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button>
        </div>
      )}
    </div>
  );
}
