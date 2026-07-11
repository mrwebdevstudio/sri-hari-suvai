import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MotionSystem } from "@/components/motion/MotionSystem";
import { CartProvider } from "@/components/cart/CartProvider";
import { JsonLd } from "@/components/ui/JsonLd";
import { websiteJsonLd } from "@/lib/jsonld";
import { getPublicCatalogue } from "@/lib/catalogue";
import { absoluteUrl, siteConfig } from "@/lib/site";

import "./globals.css";

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
  themeColor: "#f6efe3",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalogue = await getPublicCatalogue();
  return (
    <html
      lang="en"
      className={displayFont.variable + " " + bodyFont.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <CartProvider catalogue={catalogue}>
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
          <MotionSystem />
        </CartProvider>
        <JsonLd data={websiteJsonLd()} />
      </body>
    </html>
  );
}
