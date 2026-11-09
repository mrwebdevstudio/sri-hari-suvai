"use client";

import { useMemo, useState } from "react";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductSearch } from "@/components/product/ProductSearch";
import type { HeroImageMap } from "@/lib/assets";
import { productCategories, type Product, type ProductCategory } from "@/lib/products";

type CategoryFilter = "All" | ProductCategory;

export function ProductsExplorer({ products, heroImages, initialQuery }: { initialQuery: string; products: readonly Product[]; heroImages: HeroImageMap }) {
  const [query, setQuery] = useState(initialQuery);
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
        <ProductSearch id="product-search" placeholder="Search by name or category" query={query} matches={visibleProducts} onQueryChange={setQuery} />
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
          <section className="catalogue-group" id={productCategory.toLocaleLowerCase().replace(" ", "-")} key={`${category}-${query}-${productCategory}`} aria-labelledby={productCategory.replace(" ", "-") + "-heading"}>
            <div className="catalogue-group-heading">
              <h2 id={productCategory.replace(" ", "-") + "-heading"}>{productCategory}</h2>
              <span>{categoryProducts.length} products</span>
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
