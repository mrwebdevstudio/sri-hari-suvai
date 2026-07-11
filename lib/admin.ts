import { orderStatuses, type OrderStatus } from "./orders.ts";
import { productCategories, type ProductCategory } from "./products.ts";

const imagePathPattern = /^\/images\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp|jpg|jpeg)$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const fulfilmentTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function isValidFulfilmentTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || fulfilmentTransitions[from].includes(to);
}

export function isSafeHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeProductImagePath(value: string): boolean {
  return !value || imagePathPattern.test(value);
}

export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [rupees, fraction = ""] = normalized.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

export function parseNonNegativeRupeesToPaise(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [rupees, fraction = ""] = normalized.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function formatPaiseAsRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

function trimmed(value: FormDataEntryValue | null, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export type ProductUpdateInput = {
  name: string;
  category: ProductCategory;
  summary: string;
  usage: string;
  imagePath: string | null;
  sortOrder: number;
  active: boolean;
};

export function parseProductUpdate(formData: FormData): { data?: ProductUpdateInput; error?: string } {
  const name = trimmed(formData.get("name"), 150);
  const category = trimmed(formData.get("category"), 100);
  const summary = trimmed(formData.get("summary"), 1000);
  const usage = trimmed(formData.get("usage"), 1000);
  const imagePath = trimmed(formData.get("imagePath"), 250);
  const sortOrder = Number(trimmed(formData.get("sortOrder"), 10));
  if (!name) return { error: "Product name is required." };
  if (!productCategories.includes(category as ProductCategory)) return { error: "Select a valid product category." };
  if (!Number.isInteger(sortOrder) || sortOrder < 0) return { error: "Sort order must be a non-negative whole number." };
  if (!isSafeProductImagePath(imagePath)) return { error: "Image path must reference a product image under /images/products/." };
  return {
    data: {
      name,
      category: category as ProductCategory,
      summary,
      usage,
      imagePath: imagePath || null,
      sortOrder,
      active: formData.get("active") === "on",
    },
  };
}

export function isValidProductSlug(value: string): boolean {
  return slugPattern.test(value);
}

export type AnalyticsOrder = {
  payment_status: string;
  grand_total_paise: number;
  refunded_paise?: number | null;
};

export function calculateVerifiedRevenue(orders: readonly AnalyticsOrder[]): {
  grossPaise: number;
  refundedPaise: number;
  netPaise: number;
  paidOrderCount: number;
  averageOrderValuePaise: number;
} {
  let grossPaise = 0;
  let refundedPaise = 0;
  let paidOrderCount = 0;
  for (const order of orders) {
    if (order.payment_status !== "paid" && order.payment_status !== "refunded") continue;
    if (!Number.isSafeInteger(order.grand_total_paise) || order.grand_total_paise < 0) continue;
    const refund = Number.isSafeInteger(order.refunded_paise) && Number(order.refunded_paise) > 0
      ? Math.min(Number(order.refunded_paise), order.grand_total_paise)
      : 0;
    grossPaise += order.grand_total_paise;
    refundedPaise += refund;
    paidOrderCount += 1;
  }
  return {
    grossPaise,
    refundedPaise,
    netPaise: grossPaise - refundedPaise,
    paidOrderCount,
    averageOrderValuePaise: paidOrderCount ? Math.trunc(grossPaise / paidOrderCount) : 0,
  };
}

export function isKnownOrderStatus(value: string): value is OrderStatus {
  return orderStatuses.includes(value as OrderStatus);
}
