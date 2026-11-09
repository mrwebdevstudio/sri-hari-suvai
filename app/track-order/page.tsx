import type { Metadata } from "next";

import { TrackOrderForm } from "@/components/orders/TrackOrderForm";

export const metadata: Metadata = { title: "Track order", description: "Track a Sri Hari Suvai order using the order number and checkout phone number.", robots: { index: false, follow: false } };

export default function TrackOrderPage() {
  return <div className="page-wrap"><header className="page-hero shell"><p className="eyebrow">Order tracking</p><h1>Follow your order</h1><p>Enter your order number and the phone number you used at checkout.</p></header><section className="section section--first shell"><TrackOrderForm /></section></div>;
}
