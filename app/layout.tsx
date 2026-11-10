import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MotionSystem } from "@/components/motion/MotionSystem";
import { CartProvider } from "@/components/cart/CartProvider";
import { JsonLd } from "@/components/ui/JsonLd";
import { websiteJsonLd } from "@/lib/jsonld";
import { getPublicCatalogueState } from "@/lib/catalogue";
import { getOptionalUser } from "@/lib/auth";
import { absoluteUrl, siteConfig } from "@/lib/site";

import { getPublicStoreSettings } from "@/lib/store";
import { formatPrice } from "@/lib/currency";

import "./globals.css";
import "./storefront.css";

const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: "%s | " + siteConfig.name,
  },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: absoluteUrl("/"),
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#68131b",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [catalogue, settings, user] = await Promise.all([getPublicCatalogueState(), getPublicStoreSettings(), getOptionalUser()]);
  const threshold = settings.freeShippingThresholdPaise;
  const shipping = settings.checkoutEnabled && threshold !== null && threshold > 0 ? "Free shipping on orders from " + formatPrice(threshold) : undefined;
  return (
    <html
      lang="en"
      className={displayFont.variable + " " + bodyFont.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <CartProvider key={user?.id ?? "guest"} owner={user?.id} catalogue={catalogue.products} catalogueAvailable={catalogue.available}>
          <SiteHeader shipping={shipping} />
          <main id="main-content">{!catalogue.available ? <div className="catalogue-notice shell" role="status"><p className="form-message">Our catalogue is temporarily unavailable. Please try again shortly. Your saved cart has been kept.</p></div> : null}{children}</main>
          <SiteFooter />
          <MotionSystem />
        </CartProvider>
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
