"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { useCart } from "@/components/cart/CartProvider";
import { calculateCheckoutQuote } from "@/lib/checkout-pricing";
import { formatPrice, formatWeight } from "@/lib/currency";
import { buildWhatsAppHref } from "@/lib/ordering";
import type { PublicStoreSettings } from "@/lib/store";

export type CheckoutDefaults = Partial<{
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}>;

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, callback: () => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window { Razorpay?: RazorpayConstructor }
}

async function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    let finished = false;
    const finish = (loaded: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (!loaded) document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')?.remove();
      resolve(loaded);
    };
    const timeout = setTimeout(() => finish(false), 15_000);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => finish(true), { once: true });
      existing.addEventListener("error", () => finish(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
}

export function CheckoutForm({ settings, defaults }: { settings: PublicStoreSettings; defaults: CheckoutDefaults }) {
  const router = useRouter();
  const { items, subtotalPaise, clearCart, getProduct, catalogueAvailable } = useCart();
  const idempotencyKey = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const quote = useMemo(() => calculateCheckoutQuote(subtotalPaise, settings), [settings, subtotalPaise]);
  const whatsappHref = buildWhatsAppHref(settings.whatsappNumber || "");

  function forgetAttempt() {
    idempotencyKey.current = null;
    try { sessionStorage.removeItem("shs-checkout-attempt"); } catch { /* Storage is optional. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || !settings.checkoutEnabled || !quote) return;
    setSubmitting(true);
    setMessage("");
    try {
      idempotencyKey.current ||= sessionStorage.getItem("shs-checkout-attempt");
    } catch { /* The in-memory key still supports retries when storage is unavailable. */ }
    idempotencyKey.current ||= window.crypto.randomUUID();
    try { sessionStorage.setItem("shs-checkout-attempt", idempotencyKey.current); } catch { /* Storage is optional. */ }
    const values = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          expectedQuote: quote,
          idempotencyKey: idempotencyKey.current,
          items: items.map(({ productSlug, weightGrams, quantity }) => ({ productSlug, weightGrams, quantity, expectedUnitPricePaise: getProduct(productSlug)?.variants.find(v => v.weightGrams === weightGrams)?.pricePaise })),
        }),
      });
      const result = await response.json() as Record<string, string | number>;
      if (!response.ok) {
        if (result.code === "checkout_changed" || result.code === "checkout_closed") forgetAttempt();
        throw new Error(String(result.error || "Checkout could not be started."));
      }
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error("Payment checkout could not be loaded.");

      const razorpay = new window.Razorpay({
        key: result.keyId,
        amount: result.amountPaise,
        currency: "INR",
        name: "Sri Hari Suvai",
        description: `Order ${result.orderNumber}`,
        order_id: result.razorpayOrderId,
        prefill: { name: values.name, email: values.email, contact: values.phone },
        handler: async (payment: RazorpaySuccess) => {
          try {
            const verification = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderNumber: result.orderNumber, ...payment }),
            });
            const verified = await verification.json() as { error?: string; paymentStatus?: string };
            if (!verification.ok) {
              setSubmitting(false);
              setMessage(verified.error || "Payment verification failed. Your order was not marked paid.");
              return;
            }
            if (verified.paymentStatus !== "paid") {
              setSubmitting(false);
              setMessage(`Payment is awaiting confirmation. Track order ${result.orderNumber} before retrying.`);
              return;
            }
            forgetAttempt();
            clearCart();
            router.push(`/order-confirmation?order=${encodeURIComponent(String(result.orderNumber))}`);
          } catch {
            setSubmitting(false);
            setMessage(`We could not check the payment status. Track order ${result.orderNumber} before making another payment.`);
          }
        },
        modal: { ondismiss: () => { setSubmitting(false); setMessage("Payment was not completed. Your pending order can be retried from checkout."); } },
        theme: { color: "#7a2f21" },
      });
      razorpay.on("payment.failed", () => { setSubmitting(false); setMessage("Payment failed. No order will be fulfilled until payment is confirmed."); });
      razorpay.open();
    } catch (error) {
      setSubmitting(false);
      setMessage(error instanceof Error ? error.message : "Checkout could not be started.");
    }
  }

  if (!catalogueAvailable) return <div className="empty-state"><h2>Checkout is temporarily unavailable.</h2><p>We cannot verify current product prices. Your saved cart has been kept; please try again shortly.</p></div>;
  if (!items.length) return <div className="empty-state"><p className="eyebrow">Checkout</p><h2>Your cart is empty.</h2><Link className="button" href="/shop">Continue shopping</Link></div>;
  if (!settings.checkoutEnabled || !quote) {
    const orderingDisabled = !settings.productOrderingEnabled;
    return <div className="empty-state"><p className="eyebrow">Online checkout unavailable</p><h2>{orderingDisabled ? "Online ordering is currently disabled." : "Shipping has not been configured."}</h2><p>{orderingDisabled ? "Use the configured direct contact option for current ordering availability." : "Online payment remains disabled until the store owner configures shipping."}</p>{whatsappHref ? <a className="button" href={whatsappHref} target="_blank" rel="noreferrer">Order on WhatsApp</a> : <Link className="button" href="/contact">Contact Sri Hari Suvai</Link>}</div>;
  }
  if (!settings.guestCheckoutEnabled && !defaults.email) return <div className="empty-state"><p className="eyebrow">Account required</p><h2>Sign in to continue checkout.</h2><p>Guest checkout is currently disabled.</p><Link className="button" href="/login?next=%2Fcheckout">Sign in</Link></div>;

  return (
    <form className="checkout-layout" onSubmit={submit}>
      <div className="checkout-form account-panel">
        <p className="eyebrow">Delivery details</p><h2>Where should we deliver?</h2>
        <div className="form-stack">
          <label>Full name<input name="name" defaultValue={defaults.name} autoComplete="name" maxLength={100} required /></label>
          <div className="form-grid"><label>Phone<input name="phone" defaultValue={defaults.phone} type="tel" autoComplete="tel" required /></label><label>Email<input name="email" defaultValue={defaults.email} type="email" autoComplete="email" required /></label></div>
          <label>Address<input name="addressLine1" defaultValue={defaults.addressLine1} autoComplete="address-line1" maxLength={200} required /></label>
          <label>Address line 2 <span>(optional)</span><input name="addressLine2" defaultValue={defaults.addressLine2} autoComplete="address-line2" maxLength={200} /></label>
          <div className="form-grid"><label>City<input name="city" defaultValue={defaults.city} autoComplete="address-level2" required /></label><label>State<input name="state" defaultValue={defaults.state} autoComplete="address-level1" required /></label><label>Postal code<input name="postalCode" defaultValue={defaults.postalCode} autoComplete="postal-code" required /></label></div>
          <label>Order note <span>(optional)</span><textarea name="note" rows={4} maxLength={500} /></label>
        </div>
      </div>
      <aside className="cart-summary checkout-summary">
        <p className="eyebrow">Order summary</p><h2>Your order</h2>
        <div className="checkout-items">{items.map((item) => { const product = getProduct(item.productSlug); const variant = product?.variants.find((entry) => entry.weightGrams === item.weightGrams); return product && variant ? <div key={`${item.productSlug}-${item.weightGrams}`}><span>{product.name}<small>{formatWeight(item.weightGrams)} × {item.quantity}</small></span><strong>{formatPrice(variant.pricePaise * item.quantity)}</strong></div> : null; })}</div>
        <dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatPrice(subtotalPaise)}</dd></div><div><dt>Shipping</dt><dd>{quote.shippingPaise === 0 ? "Free" : formatPrice(quote.shippingPaise)}</dd></div>{quote.taxPaise > 0 && <div><dt>Tax</dt><dd>{formatPrice(quote.taxPaise)}</dd></div>}<div><dt>Total</dt><dd>{formatPrice(quote.grandTotalPaise)}</dd></div></dl>{settings.shippingNotice ? <p>{settings.shippingNotice}</p> : null}
        {message ? <p className="form-message form-message--error" role="status">{message}</p> : null}
        <button className="button" type="submit" disabled={submitting}>{submitting ? "Opening secure payment…" : "Pay securely"}</button>
        <p>Payment status is confirmed only after server-side Razorpay verification.</p>
      </aside>
    </form>
  );
}
