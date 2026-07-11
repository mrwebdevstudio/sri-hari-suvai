import type { Metadata } from "next";

import { CartContents } from "@/components/cart/CartContents";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your Sri Hari Suvai cart.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="page-wrap">
      <header className="page-hero shell"><p className="eyebrow">Your selection</p><h1>Shopping cart</h1><p>Review weights and quantities before secure checkout.</p></header>
      <section className="section section--first shell" aria-label="Shopping cart"><CartContents /></section>
    </div>
  );
}
