import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { AnimatedImagePlaceholder } from "@/components/ui/AnimatedImagePlaceholder";
import { JsonLd } from "@/components/ui/JsonLd";
import { buildHeroImageMap, resolveHeroPng } from "@/lib/assets";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/jsonld";
import { products } from "@/lib/products";
import { getPublicCatalogue, getPublicProduct } from "@/lib/catalogue";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return {};
  const heroSrc = resolveHeroPng(product.slug);

  return {
    title: product.name,
    description: product.summary,
    alternates: { canonical: "/products/" + product.slug },
    openGraph: {
      type: "website",
      title: product.name + " | Sri Hari Suvai",
      description: product.summary,
      url: "/products/" + product.slug,
      images: heroSrc ? [{ url: heroSrc, alt: product.imageAlt }] : [{ url: "/opengraph-image" }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name + " | Sri Hari Suvai",
      description: product.summary,
      images: [heroSrc || "/opengraph-image"],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();
  const heroSrc = resolveHeroPng(product.slug);
  const catalogue = await getPublicCatalogue();
  const related = catalogue
    .filter((candidate) => candidate.slug !== product.slug)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 3);
  const relatedImages = buildHeroImageMap(related);

  return (
    <div className="page-wrap product-page">
      <div className="shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol><li><Link href="/">Home</Link></li><li><Link href="/products">Products</Link></li><li aria-current="page">{product.name}</li></ol>
        </nav>

        <div className="product-detail">
          <div className="product-detail-media">
            {heroSrc ? <Image src={heroSrc} alt={product.imageAlt} fill priority sizes="(max-width: 900px) 100vw, 50vw" /> : <AnimatedImagePlaceholder label={"Product image unavailable for " + product.name} animated={false} />}
          </div>
          <div className="product-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            <p className="lead">{product.summary}</p>
            <p className="product-usage"><strong>Usage</strong><span>{product.usage}</span></p>
            <ProductPurchase product={product} />
            <Link className="text-link product-shop-link" href="/shop">Continue shopping <span>→</span></Link>
          </div>
        </div>

        <section className="section related-products" aria-labelledby="related-heading">
          <div className="section-heading"><p className="eyebrow">Continue exploring</p><h2 id="related-heading">Related products</h2></div>
          <div className="product-grid">
            {related.map((relatedProduct) => <ProductCard key={relatedProduct.slug} product={relatedProduct} heroSrc={relatedImages[relatedProduct.slug]} />)}
          </div>
        </section>
      </div>
      <JsonLd data={productJsonLd(product, heroSrc)} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Products", path: "/products" }, { name: product.name, path: "/products/" + product.slug }])} />
    </div>
  );
}
