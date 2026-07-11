import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const orderStatuses = ["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"] as const;
export const paymentStatuses = ["pending", "paid", "failed", "refunded"] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function generateOrderNumber(date = new Date(), entropy = randomBytes(6)): string {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const suffix = Array.from(entropy.subarray(0, 6), (byte) => alphabet[byte % alphabet.length]).join("");
  return `SHS-${day}-${suffix}`;
}

export function calculateShippingPaise(
  subtotalPaise: number,
  flatShippingPaise: number | null,
  freeShippingThresholdPaise: number | null,
): number | null {
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) return null;
  if (
    freeShippingThresholdPaise !== null &&
    Number.isInteger(freeShippingThresholdPaise) &&
    freeShippingThresholdPaise >= 0 &&
    subtotalPaise >= freeShippingThresholdPaise
  ) {
    return 0;
  }
  return flatShippingPaise !== null && Number.isInteger(flatShippingPaise) && flatShippingPaise >= 0
    ? flatShippingPaise
    : null;
}

export function createHmacSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmacSignature(payload: string, receivedSignature: string, secret: string): boolean {
  if (!receivedSignature || !secret) return false;
  const expected = Buffer.from(createHmacSignature(payload, secret), "utf8");
  const received = Buffer.from(receivedSignature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && orderStatuses.includes(value as OrderStatus);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && paymentStatuses.includes(value as PaymentStatus);
}
