import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/account/", "/checkout", "/login", "/signup", "/forgot-password", "/reset-password", "/order-confirmation", "/track-order", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
