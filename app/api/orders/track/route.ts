import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isValidPhone, normalizePhone } from "@/lib/validation";

export async function POST(request: Request) {
  const rate = rateLimitRequest(request, "guest-order-tracking", 10, 60_000);
  if (!rate.allowed) return noStoreJson({ error: "Order tracking is temporarily unavailable. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return noStoreJson({ error: "We could not verify that order." }, { status: 400 }); }
  const orderNumber = typeof input.orderNumber === "string" ? input.orderNumber.trim().toUpperCase() : "";
  const phone = normalizePhone(input.phone);
  if (!/^SHS-\d{8}-[A-Z2-9]{6}$/.test(orderNumber) || !isValidPhone(phone)) return noStoreJson({ error: "We could not verify that order." }, { status: 404 });

  try {
    const admin = createAdminSupabaseClient();
    const { data: order } = await admin.from("orders").select("order_number, status, payment_status, subtotal_paise, shipping_paise, grand_total_paise, tracking_number, courier, tracking_url, shipping_note, created_at, order_items(product_name, variant_name, quantity, line_total_paise), order_status_history(id, status, note, created_at)").eq("order_number", orderNumber).eq("phone", phone).maybeSingle();
    if (!order) return noStoreJson({ error: "We could not verify that order." }, { status: 404 });
    return noStoreJson({ order });
  } catch (error) {
    logger.error("order.tracking_failed", { orderNumber, error });
    return noStoreJson({ error: "Order tracking is unavailable. Try again later." }, { status: 503 });
  }
}
