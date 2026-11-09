import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDER_RECEIPT_COOKIE = "shs-order-receipt";
export const ORDER_RECEIPT_SECONDS = 60 * 60;
const orderPattern = /^SHS-\d{8}-[A-Z2-9]{6}$/;

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(`order-receipt:v1:${value}`).digest("hex");
}

export function createOrderReceipt(orderNumber: string, secret: string, now = Date.now()): string {
  if (!secret || !orderPattern.test(orderNumber)) throw new Error("Cannot issue order receipt.");
  const value = `${orderNumber}.${Math.floor(now / 1000) + ORDER_RECEIPT_SECONDS}`;
  return `${value}.${signature(value, secret)}`;
}

export function verifyOrderReceipt(receipt: string, orderNumber: string, secret: string, now = Date.now()): boolean {
  if (!secret || !orderPattern.test(orderNumber)) return false;
  const parts = receipt.split(".");
  if (parts.length !== 3 || parts[0] !== orderNumber || !/^\d{10}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const remaining = Number(parts[1]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > ORDER_RECEIPT_SECONDS) return false;
  return timingSafeEqual(Buffer.from(parts[2], "hex"), Buffer.from(signature(`${parts[0]}.${parts[1]}`, secret), "hex"));
}

export function paymentConfirmationCopy(status: string | null): { title: string; message: string } {
  switch (status) {
    case "paid": return { title: "Payment confirmed", message: "Your payment has been confirmed. You can follow your order using the links below." };
    case "refunded": return { title: "Payment refunded", message: "A refund has been recorded for this order. Check your order details for updates." };
    case "failed": return { title: "Payment not completed", message: "Payment has not been confirmed for this order. Check its status before trying again." };
    case "pending": return { title: "Payment is being confirmed", message: "Your order is awaiting payment confirmation. If you have paid, check its status before making another payment." };
    default: return { title: "Check your order status", message: "We could not verify an order on this page. Sign in to view your orders, or track your order using its number and phone number." };
  }
}
