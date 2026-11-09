"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { formatPrice, formatWeight } from "@/lib/currency";
import { products as fallbackProducts, type Product } from "@/lib/products";

export type CartItem = {
  productSlug: string;
  weightGrams: number;
  quantity: number;
};

type CartContextValue = {
  catalogueAvailable: boolean;
  items: readonly CartItem[];
  itemCount: number;
  subtotalPaise: number;
  addItem: (productSlug: string, weightGrams: number) => void;
  updateQuantity: (productSlug: string, weightGrams: number, quantity: number) => void;
  removeItem: (productSlug: string, weightGrams: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getProduct: (slug: string) => Product | undefined;
};

const STORAGE_KEY = "sri-hari-suvai-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown, getProduct: (slug: string) => Product | undefined): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  const product = typeof item.productSlug === "string" ? getProduct(item.productSlug) : undefined;
  return Boolean(
    product &&
      Number.isInteger(item.weightGrams) &&
      product.variants.some((variant) => variant.weightGrams === item.weightGrams) &&
      Number.isInteger(item.quantity) &&
      (item.quantity ?? 0) > 0,
  );
}

export function CartProvider({ children, catalogue = fallbackProducts, catalogueAvailable = true }: { children: ReactNode; catalogue?: readonly Product[]; catalogueAvailable?: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const catalogueBySlug = useMemo(() => new Map(catalogue.map((product) => [product.slug, product])), [catalogue]);
  const getProduct = useCallback((slug: string) => catalogueBySlug.get(slug), [catalogueBySlug]);

  useEffect(() => {
    if (!catalogueAvailable) return;
    let storedItems: CartItem[] = [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) storedItems = parsed.filter((item) => isCartItem(item, getProduct));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      setItems(storedItems);
      setHydrated(true);
    });
  }, [getProduct, catalogueAvailable]);

  useEffect(() => {
    if (!hydrated || !catalogueAvailable) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items, catalogueAvailable]);

  const addItem = useCallback((productSlug: string, weightGrams: number) => {
    const variant = getProduct(productSlug)?.variants.find((entry) => entry.weightGrams === weightGrams);
    if (!catalogueAvailable || !variant || variant.available === false) return;
    setItems((current) => {
      const existing = current.find(
        (item) => item.productSlug === productSlug && item.weightGrams === weightGrams,
      );
      if (!existing) return [...current, { productSlug, weightGrams, quantity: 1 }];
      return current.map((item) =>
        item === existing ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item,
      );
    });
  }, [getProduct, catalogueAvailable]);

  const removeItem = useCallback((productSlug: string, weightGrams: number) => {
    setItems((current) =>
      current.filter(
        (item) => !(item.productSlug === productSlug && item.weightGrams === weightGrams),
      ),
    );
  }, []);
  const clearCart = useCallback(() => setItems([]), []);

  const updateQuantity = useCallback((productSlug: string, weightGrams: number, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    if (quantity <= 0) {
      removeItem(productSlug, weightGrams);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.productSlug === productSlug && item.weightGrams === weightGrams
          ? { ...item, quantity: Math.min(99, quantity) }
          : item,
      ),
    );
  }, [removeItem]);

  const openCart = useCallback(() => setDrawerOpen(true), []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);

  const totals = useMemo(() => {
    let itemCount = 0;
    let subtotalPaise = 0;
    for (const item of items) {
      const product = getProduct(item.productSlug);
      const variant = product?.variants.find((entry) => entry.weightGrams === item.weightGrams);
      if (!variant) continue;
      itemCount += item.quantity;
      subtotalPaise += variant.pricePaise * item.quantity;
    }
    return { itemCount, subtotalPaise };
  }, [getProduct, items]);

  const value = useMemo<CartContextValue>(
    () => ({
      catalogueAvailable,
      items,
      ...totals,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      openCart,
      closeCart,
      getProduct,
    }),
    [addItem, clearCart, closeCart, getProduct, items, openCart, removeItem, totals, updateQuantity, catalogueAvailable],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      {drawerOpen ? <CartDrawer /> : null}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

export function CartButton({ className = "" }: { className?: string }) {
  const { itemCount, openCart } = useCart();
  return (
    <button
      className={`cart-button ${className}`.trim()}
      type="button"
      onClick={openCart}
      aria-label={`Open cart${itemCount ? ` with ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      <span className="cart-badge" key={itemCount} aria-hidden="true">{itemCount}</span>
    </button>
  );
}

function CartDrawer() {
  const { items, subtotalPaise, closeCart, updateQuantity, removeItem, getProduct } = useCart();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [closeCart]);

  return (
    <div className="cart-overlay" onMouseDown={closeCart}>
      <aside
        ref={drawerRef}
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cart-drawer-header">
          <div>
            <p className="eyebrow">Your selection</p>
            <h2 id="cart-drawer-title">Cart</h2>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={closeCart} aria-label="Close cart">
            ×
          </button>
        </div>

        {items.length ? (
          <div className="cart-drawer-items">
            {items.map((item) => {
              const product = getProduct(item.productSlug);
              const variant = product?.variants.find((entry) => entry.weightGrams === item.weightGrams);
              if (!product || !variant) return null;
              return (
                <article className="cart-drawer-item" key={`${item.productSlug}-${item.weightGrams}`}>
                  <Image
                    src={product.imagePath || `/images/products/${product.slug}.png`}
                    alt=""
                    width={72}
                    height={90}
                    sizes="72px"
                  />
                  <div>
                    <h3>{product.name}</h3>
                    <p>{formatWeight(item.weightGrams)} · {formatPrice(variant.pricePaise)}</p>
                    <div className="quantity-control" aria-label={`Quantity for ${product.name}, ${formatWeight(item.weightGrams)}`}>
                      <button type="button" onClick={() => updateQuantity(item.productSlug, item.weightGrams, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.productSlug, item.weightGrams, item.quantity + 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <button className="remove-button" type="button" onClick={() => removeItem(item.productSlug, item.weightGrams)}>Remove</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="cart-drawer-empty">
            <p>Your cart is ready for something delicious.</p>
            <Link className="button" href="/shop" onClick={closeCart}>Continue shopping</Link>
          </div>
        )}

        {items.length ? (
          <div className="cart-drawer-footer">
            <div className="cart-subtotal"><span>Subtotal</span><strong className="motion-price" key={subtotalPaise}>{formatPrice(subtotalPaise)}</strong></div>
            <Link className="button" href="/cart" onClick={closeCart}>View cart</Link>
            <button className="text-button" type="button" onClick={closeCart}>Continue shopping</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
