import { verifyHmacSignature } from "./orders.ts";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
};

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");
  if (process.env.COMMERCE_ENVIRONMENT !== "production" && !keyId.startsWith("rzp_test_")) throw new Error("Development checkout requires Razorpay test credentials.");
  return { keyId, keySecret };
}

export function getRazorpayKeyId(): string {
  return getRazorpayCredentials().keyId;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  orderNumber: string;
  customerEmail: string;
  customerPhone: string;
}): Promise<RazorpayOrder & { keyId: string }> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const headers = { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" };
  const ordersUrl = "https://api.razorpay.com/v1/orders";
  // Razorpay receipts are unique. Recover a possibly committed POST before trying again.
  const lookup = await fetch(`${ordersUrl}?receipt=${encodeURIComponent(input.orderNumber)}&count=2`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!lookup.ok) throw new Error(`Razorpay receipt lookup failed (${lookup.status}).`);
  const collection = await lookup.json() as { items: RazorpayOrder[] };
  if (!Array.isArray(collection.items) || collection.items.length > 1) throw new Error("Ambiguous provider receipt.");
  let order = collection.items[0];
  if (!order) {
    const response = await fetch(ordersUrl, {
      method: "POST", headers, cache: "no-store", signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.orderNumber,
        notes: { email: input.customerEmail, phone: input.customerPhone } }),
    });
    if (!response.ok) throw new Error(`Razorpay order creation failed (${response.status}).`);
    order = await response.json() as RazorpayOrder;
  }
  if (!order.id || order.receipt !== input.orderNumber || order.amount !== input.amountPaise || order.currency !== "INR") {
    throw new Error("Razorpay returned an invalid order.");
  }
  return { ...order, keyId };
}

export function verifyRazorpayPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getRazorpayCredentials();
  return verifyHmacSignature(
    `${input.providerOrderId}|${input.providerPaymentId}`,
    input.signature,
    keySecret,
  );
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Razorpay payment lookup failed (${response.status}).`);
  return (await response.json()) as RazorpayPayment;
}
