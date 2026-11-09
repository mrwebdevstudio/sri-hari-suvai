import { sendOrderEmailEvent } from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { fetchRazorpayPayment, verifyRazorpayPayment } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const NextResponse = { json: noStoreJson };

function value(source: Record<string, unknown>, key: string, maximum = 200): string {
  const item = source[key];
  return typeof item === "string" ? item.trim().slice(0, maximum) : "";
}

export async function POST(request: Request) {
  const rate = rateLimitRequest(request, "payment-verify", 20, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many verification attempts. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const orderNumber = value(input, "orderNumber", 30);
  const providerPaymentId = value(input, "razorpay_payment_id");
  const providerOrderId = value(input, "razorpay_order_id");
  const signature = value(input, "razorpay_signature");
  if (!orderNumber || !providerPaymentId || !providerOrderId || !signature) return NextResponse.json({ error: "Payment verification details are incomplete." }, { status: 400 });

  try {
    const admin = createAdminSupabaseClient();
    const { data: order } = await admin.from("orders").select("id, order_number, email, grand_total_paise, razorpay_order_id, razorpay_payment_id, payment_status").eq("order_number", orderNumber).single();
    if (!order || order.razorpay_order_id !== providerOrderId) return NextResponse.json({ error: "Payment does not match this order." }, { status: 400 });
    if (!verifyRazorpayPayment({ providerOrderId: order.razorpay_order_id, providerPaymentId, signature })) return NextResponse.json({ error: "Payment signature is invalid." }, { status: 400 });

    const payment = await fetchRazorpayPayment(providerPaymentId);
    if (payment.order_id !== order.razorpay_order_id || payment.amount !== order.grand_total_paise || payment.currency !== "INR") return NextResponse.json({ error: "Payment amount or order reference does not match." }, { status: 400 });
    if (payment.status !== "captured") return NextResponse.json({ paymentStatus: "pending", orderNumber }, { status: 202 });

    const { data: applied, error } = await admin.rpc("apply_payment_event", {
      p_order_id: order.id,
      p_provider_event_id: `checkout:${providerPaymentId}`,
      p_event_type: "checkout.signature_verified_and_captured",
      p_target_status: "paid",
      p_provider_payment_id: providerPaymentId,
      p_payload: { amount: payment.amount, currency: payment.currency, captureStatus: payment.status, signatureVerified: true },
    });
    if (error) throw error;
    if (applied) await sendOrderEmailEvent("payment_success", { orderNumber, email: order.email, amountPaise: order.grand_total_paise }).catch(() => undefined);
    const { data: current, error: statusError } = await admin.from("orders").select("payment_status").eq("id", order.id).single();
    if (statusError) throw statusError;
    return NextResponse.json({ paymentStatus: current.payment_status, orderNumber });
  } catch (error) {
    logger.error("payment.verification_failed", { route: "/api/payments/verify", orderNumber, error });
    return NextResponse.json({ error: "Payment verification could not be completed. The order remains unfulfilled." }, { status: 500 });
  }
}
