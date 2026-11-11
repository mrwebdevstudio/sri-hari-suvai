export function formatPrice(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: pricePaise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pricePaise / 100);
}

export function formatWeight(weightGrams: number): string {
  return `${weightGrams}g`;
}
