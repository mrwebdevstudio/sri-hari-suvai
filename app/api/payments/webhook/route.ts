import { createHash } from "node:crypto";

import { sendOrderEmailEvent } from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { verifyHmacSignature } from "@/lib/orders";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const NextResponse = { json: noStoreJson };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function POST(request: Request) {
  const rate = rateLimitRequest(request, "razorpay-webhook", 300, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Webhook rate limit exceeded." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  if (!verifyHmacSignature(rawBody, signature, secret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }
  const eventType = typeof body.event === "string" ? body.event : "";
  const payload = record(body.payload);
  const payment = record(record(payload.payment).entity);
  const providerOrder = record(record(payload.order).entity);
  const refund = record(record(payload.refund).entity);

  const targetStatus = eventType === "payment.captured" || eventType === "order.paid"
    ? "paid"
    : eventType === "payment.failed"
      ? "failed"
      : eventType === "refund.processed"
        ? "refunded"
        : null;
  if (!targetStatus) return NextResponse.json({ received: true, handled: false });

  const providerPaymentId = String(payment.id || refund.payment_id || "");
  const providerOrderId = String(payment.order_id || providerOrder.id || "");
  const eventId = request.headers.get("x-razorpay-event-id") || createHash("sha256").update(rawBody).digest("hex");

  try {
    const admin = createAdminSupabaseClient();
    let query = admin.from("orders").select("id, order_number, email, grand_total_paise, payment_status");
    query = providerOrderId ? query.eq("razorpay_order_id", providerOrderId) : query.eq("razorpay_payment_id", providerPaymentId);
    const { data: order } = await query.maybeSingle();
    if (!order) return NextResponse.json({ received: true, handled: false });

    const paidAmount = Number(payment.amount || providerOrder.amount_paid || 0);
    if (targetStatus === "paid" && (paidAmount !== order.grand_total_paise || String(payment.currency || providerOrder.currency || "INR") !== "INR")) return NextResponse.json({ error: "Webhook amount mismatch." }, { status: 400 });
    const eventAmount = targetStatus === "refunded" ? Number(refund.amount || 0) : paidAmount;
    const eventCurrency = String(payment.currency || providerOrder.currency || refund.currency || "INR");
    if (!Number.isSafeInteger(eventAmount) || eventAmount < 0 || eventCurrency !== "INR") return NextResponse.json({ error: "Webhook amount mismatch." }, { status: 400 });

    const { data: applied, error } = await admin.rpc("apply_payment_event", {
      p_order_id: order.id,
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_target_status: targetStatus,
      p_provider_payment_id: providerPaymentId,
      p_payload: {
        amount: eventAmount,
        currency: eventCurrency,
        captureStatus: String(payment.status || providerOrder.status || ""),
        signatureVerified: true,
        refundId: String(refund.id || ""),
      },
    });
    if (error) throw error;
    if (applied && targetStatus === "paid") await sendOrderEmailEvent("payment_success", { orderNumber: order.order_number, email: order.email, amountPaise: order.grand_total_paise }).catch(() => undefined);
    return NextResponse.json({ received: true, handled: true, duplicate: !applied });
  } catch (error) {
    logger.error("payment.webhook_failed", { route: "/api/payments/webhook", eventId, eventType, error });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
