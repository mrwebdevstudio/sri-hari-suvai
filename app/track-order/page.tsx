import type { Metadata } from "next";

import { TrackOrderForm } from "@/components/orders/TrackOrderForm";

export const metadata: Metadata = { title: "Track order", description: "Track a Sri Hari Suvai order using the order number and checkout phone number.", robots: { index: false, follow: false } };

export default function TrackOrderPage() {
  return <div className="page-wrap"><header className="page-hero shell"><p className="eyebrow">Order tracking</p><h1>Follow your order</h1><p>We show confirmed status updates only—never invented delivery dates.</p></header><section className="section section--first shell"><TrackOrderForm /></section></div>;
}
