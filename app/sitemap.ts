import type { MetadataRoute } from "next";

import { getPublicCatalogue } from "@/lib/catalogue";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getPublicCatalogue();
  const staticRoutes = ["/", "/products", "/shop", "/about", "/contact"];
  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route),
      changeFrequency: route === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: route === "/" ? 1 : 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl("/products/" + product.slug),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
