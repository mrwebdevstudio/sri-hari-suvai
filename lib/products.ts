export const productCategories = ["Instant Mix", "Direct Mix"] as const;

export type ProductCategory = (typeof productCategories)[number];

export type ProductVariant = {
  weightGrams: number;
  pricePaise: number;
};

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  summary: string;
  usage: string;
  imageAlt: string;
  imagePath?: string | null;
  variants: readonly ProductVariant[];
};

const variants = (pricesInRupees: readonly [number, number, number, number]): readonly ProductVariant[] =>
  ([100, 250, 500, 1000] as const).map((weightGrams, index) => ({
    weightGrams,
    pricePaise: pricesInRupees[index] * 100,
  }));

export const products: readonly Product[] = [
  {
    slug: "sambar-podi",
    name: "Sambar Podi",
    category: "Instant Mix",
    summary: "A measured podi for preparing a comforting bowl of sambar.",
    usage: "Use to prepare sambar.",
    imageAlt: "Sambar Podi in a brass bowl with prepared sambar behind it",
    variants: variants([100, 200, 400, 800]),
  },
  {
    slug: "rasam-podi",
    name: "Rasam Podi",
    category: "Instant Mix",
    summary: "A convenient podi for preparing aromatic South Indian rasam.",
    usage: "Use to prepare rasam.",
    imageAlt: "Rasam Podi in a brass bowl with prepared rasam behind it",
    variants: variants([100, 200, 400, 800]),
  },
  {
    slug: "vathakkuzhambu-podi",
    name: "Vathakkuzhambu Podi",
    category: "Instant Mix",
    summary: "A practical podi for preparing vathakkuzhambu at home.",
    usage: "Use to prepare vathakkuzhambu.",
    imageAlt: "Vathakkuzhambu Podi in a brass bowl with vathakkuzhambu behind it",
    variants: variants([90, 175, 350, 700]),
  },
  {
    slug: "vendhya-kuzhambu-podi",
    name: "Vendhya Kuzhambu Podi",
    category: "Instant Mix",
    summary: "A convenient podi for preparing vendhya kuzhambu.",
    usage: "Use to prepare vendhya kuzhambu.",
    imageAlt: "Vendhya Kuzhambu Podi in a brass bowl with vendhya kuzhambu behind it",
    variants: variants([90, 175, 350, 700]),
  },
  {
    slug: "morkuzhambu-podi",
    name: "Morkuzhambu Podi",
    category: "Instant Mix",
    summary: "A measured podi for preparing traditional morkuzhambu.",
    usage: "Use to prepare morkuzhambu.",
    imageAlt: "Morkuzhambu Podi in a brass bowl with prepared morkuzhambu behind it",
    variants: variants([90, 175, 350, 700]),
  },
  {
    slug: "poriyal-podi",
    name: "Poriyal Podi",
    category: "Instant Mix",
    summary: "A convenient podi for bringing a finished touch to poriyal.",
    usage: "Use while preparing vegetable poriyal.",
    imageAlt: "Poriyal Podi in a brass bowl with vegetable poriyal behind it",
    variants: variants([100, 200, 400, 800]),
  },
  {
    slug: "koottu-podi",
    name: "Koottu Podi",
    category: "Instant Mix",
    summary: "A practical podi for preparing a homestyle koottu.",
    usage: "Use to prepare koottu.",
    imageAlt: "Koottu Podi in a brass bowl with vegetable koottu behind it",
    variants: variants([100, 200, 400, 800]),
  },
  {
    slug: "kuruma-podi",
    name: "Kuruma Podi",
    category: "Instant Mix",
    summary: "A measured podi for preparing a rich vegetable kuruma.",
    usage: "Use to prepare kuruma.",
    imageAlt: "Kuruma Podi in a brass bowl with vegetable kuruma behind it",
    variants: variants([125, 225, 450, 900]),
  },
  {
    slug: "bisibelabath-podi",
    name: "Bisibelabath Podi",
    category: "Instant Mix",
    summary: "A convenient podi for preparing a warm bowl of bisibelabath.",
    usage: "Use to prepare bisibelabath.",
    imageAlt: "Bisibelabath Podi in a brass bowl with bisibelabath behind it",
    variants: variants([125, 225, 450, 900]),
  },
  {
    slug: "arisi-upma-mix",
    name: "Arisi Upma Mix",
    category: "Instant Mix",
    summary: "A ready mix for preparing a simple serving of arisi upma.",
    usage: "Use to prepare arisi upma.",
    imageAlt: "Arisi Upma Mix in a brass bowl with prepared arisi upma behind it",
    variants: variants([35, 70, 140, 280]),
  },
  {
    slug: "puliyodharai-podi",
    name: "Puliyodharai Podi",
    category: "Direct Mix",
    summary: "A direct mix for preparing tangy puliyodharai rice.",
    usage: "Mix with rice to prepare puliyodharai.",
    imageAlt: "Puliyodharai Podi in a brass bowl with tamarind rice behind it",
    variants: variants([90, 175, 350, 700]),
  },
  {
    slug: "paruppu-podi",
    name: "Paruppu Podi",
    category: "Direct Mix",
    summary: "A direct-mix podi made to accompany warm rice.",
    usage: "Mix with warm rice and serve.",
    imageAlt: "Paruppu Podi in a brass bowl with warm rice behind it",
    variants: variants([65, 125, 250, 500]),
  },
  {
    slug: "dhaniya-podi",
    name: "Dhaniya Podi",
    category: "Direct Mix",
    summary: "A versatile direct-mix podi for serving with warm rice.",
    usage: "Mix with warm rice and serve.",
    imageAlt: "Dhaniya Podi in a brass bowl with warm rice behind it",
    variants: variants([65, 125, 250, 500]),
  },
  {
    slug: "idly-podi",
    name: "Idly Podi",
    category: "Direct Mix",
    summary: "A classic podi accompaniment for idly and dosa.",
    usage: "Serve as an accompaniment to idly or dosa.",
    imageAlt: "Idly Podi in a brass bowl with steamed idlies behind it",
    variants: variants([75, 150, 300, 600]),
  },
  {
    slug: "thenga-podi",
    name: "Thenga Podi",
    category: "Direct Mix",
    summary: "A direct-mix podi for serving alongside warm rice.",
    usage: "Mix with warm rice and serve.",
    imageAlt: "Thenga Podi in a brass bowl with warm rice behind it",
    variants: variants([100, 200, 400, 800]),
  },
  {
    slug: "vellai-ellu-podi",
    name: "Vellai Ellu Podi",
    category: "Direct Mix",
    summary: "A white sesame podi intended as a direct rice accompaniment.",
    usage: "Mix with warm rice and serve.",
    imageAlt: "Vellai Ellu Podi in a brass bowl with warm rice behind it",
    variants: variants([100, 200, 400, 800]),
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 3): Product[] {
  const peers = products.filter(
    (candidate) => candidate.slug !== product.slug && candidate.category === product.category,
  );
  const remaining = products.filter(
    (candidate) =>
      candidate.slug !== product.slug &&
      !peers.some((peer) => peer.slug === candidate.slug),
  );

  return [...peers, ...remaining].slice(0, limit);
}

export function getStartingPricePaise(product: Product): number {
  return Math.min(...product.variants.map((variant) => variant.pricePaise));
}
