import { unstable_cache } from "next/cache";

import { products as fallbackProducts, type Product, type ProductCategory } from "@/lib/products";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

type CatalogueRow = {
  slug: string;
  name: string;
  category: ProductCategory;
  summary: string;
  usage: string;
  image_alt: string;
  image_path: string | null;
  product_variants: { weight_grams: number; price_paise: number; active: boolean }[];
};

async function loadCatalogue(): Promise<readonly Product[]> {
  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select("slug, name, category, summary, usage, image_alt, image_path, product_variants(weight_grams, price_paise, active)")
      .eq("active", true)
      .eq("product_variants.active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return ((data || []) as CatalogueRow[]).map((row) => ({
      slug: row.slug,
      name: row.name,
      category: row.category,
      summary: row.summary,
      usage: row.usage,
      imageAlt: row.image_alt,
      imagePath: row.image_path,
      variants: (row.product_variants || [])
        .filter((variant) => variant.active)
        .sort((a, b) => a.weight_grams - b.weight_grams)
        .map((variant) => ({ weightGrams: variant.weight_grams, pricePaise: variant.price_paise })),
    })).filter((product) => product.variants.length > 0);
  } catch {
    return fallbackProducts;
  }
}

const getCachedCatalogue = unstable_cache(loadCatalogue, ["public-catalogue-v1"], {
  revalidate: 300,
  tags: ["catalogue"],
});

export async function getPublicCatalogue(): Promise<readonly Product[]> {
  return getCachedCatalogue();
}

export async function getPublicProduct(slug: string): Promise<Product | undefined> {
  return (await getPublicCatalogue()).find((product) => product.slug === slug);
}
