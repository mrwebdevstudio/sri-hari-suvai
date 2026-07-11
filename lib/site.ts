const fallbackUrl = "http://localhost:3000";

export const siteConfig = {
  name: "Sri Hari Suvai",
  description:
    "Explore Sri Hari Suvai's approved South Indian food-product catalogue and contact options.",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || fallbackUrl,
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}

export function isProductionSiteConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SITE_URL);
}
