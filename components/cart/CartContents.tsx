"use client";

import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import { formatPrice, formatWeight } from "@/lib/currency";

export function CartContents() {
  const { items, subtotalPaise, updateQuantity, removeItem, getProduct } = useCart();

  if (!items.length) {
    return (
      <div className="cart-empty empty-state">
        <p className="eyebrow">Your cart is empty</p>
        <h2>Start with a Sri Hari Suvai favourite.</h2>
        <p>Add any available weight from the shop. Your selection will stay on this device.</p>
        <Link className="button" href="/shop">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-page-layout">
      <div className="cart-page-items">
        {items.map((item) => {
          const product = getProduct(item.productSlug);
          const variant = product?.variants.find((entry) => entry.weightGrams === item.weightGrams);
          if (!product || !variant) return null;
          return (
            <article className="cart-page-item" key={`${item.productSlug}-${item.weightGrams}`}>
              <Link className="cart-page-image" href={`/products/${product.slug}`}>
                <Image src={`/images/products/${product.slug}.png`} alt={product.imageAlt} fill sizes="(max-width: 640px) 112px, 150px" />
              </Link>
              <div className="cart-page-item-copy">
                <p className="eyebrow">{product.category}</p>
                <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
                <p>{formatWeight(item.weightGrams)} · {formatPrice(variant.pricePaise)} each</p>
                <div className="quantity-control" aria-label={`Quantity for ${product.name}, ${formatWeight(item.weightGrams)}`}>
                  <button type="button" onClick={() => updateQuantity(item.productSlug, item.weightGrams, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.productSlug, item.weightGrams, item.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
                <button className="remove-button" type="button" onClick={() => removeItem(item.productSlug, item.weightGrams)}>Remove</button>
              </div>
              <strong className="cart-line-total motion-price" key={item.quantity}>{formatPrice(variant.pricePaise * item.quantity)}</strong>
            </article>
          );
        })}
      </div>
      <aside className="cart-summary" aria-labelledby="cart-summary-title">
        <p className="eyebrow">Summary</p>
        <h2 id="cart-summary-title">Cart total</h2>
        <div className="cart-subtotal"><span>Subtotal</span><strong className="motion-price" key={subtotalPaise}>{formatPrice(subtotalPaise)}</strong></div>
        <p>Shipping and payment totals are securely calculated during checkout.</p>
        <Link className="button" href="/checkout">Secure checkout</Link>
        <Link className="button button--secondary" href="/shop">Continue shopping</Link>
      </aside>
    </div>
  );
}
