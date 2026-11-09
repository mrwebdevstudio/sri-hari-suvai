import type { Product } from "@/lib/products";
import { absoluteUrl, siteConfig } from "@/lib/site";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: siteConfig.name, url: siteConfig.url },
      { "@type": "WebSite", "@id": absoluteUrl("/#website"), name: siteConfig.name, url: siteConfig.url, publisher: { "@id": absoluteUrl("/#organization") } },
    ],
  };
}

export function productJsonLd(product: Product, imagePath?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.summary,
    category: product.category,
    url: absoluteUrl("/products/" + product.slug),
    ...(imagePath ? { image: [absoluteUrl(imagePath)] } : {}),
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      name: `${product.name} ${variant.weightGrams}g`,
      price: (variant.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      ...(variant.available === undefined ? {} : { availability: variant.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }),
      url: absoluteUrl("/products/" + product.slug),
    })),
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}
