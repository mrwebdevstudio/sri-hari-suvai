import { createHash } from "node:crypto";

import { sendOrderEmailEvent } from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { readRazorpayEvent } from "@/lib/razorpay-events";
import { verifyHmacSignature } from "@/lib/orders";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const NextResponse = { json: noStoreJson };

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
  const event = readRazorpayEvent(body);
  if (event.kind === "ignored") return NextResponse.json({ received: true, handled: false });
  if (event.kind === "invalid") return NextResponse.json({ error: "Invalid payment event evidence." }, { status: 400 });
  const { eventType, targetStatus, providerPaymentId, providerOrderId, eventAmount, eventCurrency, captureStatus, refundId } = event;
  const eventId = request.headers.get("x-razorpay-event-id") || createHash("sha256").update(rawBody).digest("hex");

  try {
    const admin = createAdminSupabaseClient();
    let query = admin.from("orders").select("id, order_number, email, grand_total_paise, payment_status");
    query = providerOrderId ? query.eq("razorpay_order_id", providerOrderId) : query.eq("razorpay_payment_id", providerPaymentId);
    const { data: order, error: lookupError } = await query.maybeSingle();
    if (lookupError) throw lookupError;
    // A refund may arrive before capture, or capture before the provider ID is saved.
    if (!order) return NextResponse.json({ error: "Order correlation pending." }, { status: 503 });
    if (targetStatus === "paid" && eventAmount !== order.grand_total_paise) {
      return NextResponse.json({ error: "Webhook amount mismatch." }, { status: 400 });
    }

    const { data: applied, error } = await admin.rpc("apply_payment_event", {
      p_order_id: order.id,
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_target_status: targetStatus,
      p_provider_payment_id: providerPaymentId,
      p_payload: {
        amount: eventAmount,
        currency: eventCurrency,
        captureStatus,
        signatureVerified: true,
        refundId,
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
