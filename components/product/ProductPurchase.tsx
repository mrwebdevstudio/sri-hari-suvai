"use client";

import { useId, useState } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { formatPrice, formatWeight } from "@/lib/currency";
import type { Product } from "@/lib/products";

export function ProductPurchase({ product }: { product: Product }) {
  const id = useId();
  const [weightGrams, setWeightGrams] = useState(product.variants[0].weightGrams);
  const [added, setAdded] = useState(false);
  const { addItem, openCart } = useCart();
  const variant = product.variants.find((entry) => entry.weightGrams === weightGrams) ?? product.variants[0];

  const addToCart = () => {
    addItem(product.slug, variant.weightGrams);
    setAdded(true);
  };

  return (
    <div className="product-purchase">
      <label htmlFor={id}>Choose weight</label>
      <select id={id} value={weightGrams} onChange={(event) => { setWeightGrams(Number(event.target.value) as typeof weightGrams); setAdded(false); }}>
        {product.variants.map((entry) => (
          <option key={entry.weightGrams} value={entry.weightGrams}>
            {formatWeight(entry.weightGrams)} — {formatPrice(entry.pricePaise)}
          </option>
        ))}
      </select>
      <p className="purchase-price motion-price" key={variant.weightGrams} aria-live="polite">{formatPrice(variant.pricePaise)}</p>
      <div className="button-row">
        <button className="button" data-added={added || undefined} type="button" onClick={addToCart}>{added ? "Added" : "Add to cart"}</button>
        {added ? <button className="button button--secondary" type="button" onClick={openCart}>View cart</button> : null}
      </div>
      <p className="purchase-status" role="status">{added ? `${formatWeight(variant.weightGrams)} added to your cart.` : ""}</p>
    </div>
  );
}
