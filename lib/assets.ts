import { existsSync } from "node:fs";
import path from "node:path";

import type { Product } from "@/lib/products";

export type HeroImageMap = Record<string, string | null>;

export function resolveHeroPng(slug: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  const publicPath = "/images/products/" + slug + ".png";
  const filePath = path.join(process.cwd(), "public", "images", "products", slug + ".png");
  return existsSync(filePath) ? publicPath : null;
}

export function resolvePackIllustration(slug: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const src = "/images/storefront/packs/" + slug + ".webp";
  return existsSync(path.join(process.cwd(), "public", src)) ? src : null;
}

export function buildHeroImageMap(items: readonly Pick<Product, "slug" | "imagePath">[]): HeroImageMap {
  return Object.fromEntries(items.map((product) => [product.slug, product.imagePath || resolveHeroPng(product.slug)]));
}
