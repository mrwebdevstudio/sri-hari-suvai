export function formatPrice(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

export function formatWeight(weightGrams: number): string {
  return `${weightGrams}g`;
}
