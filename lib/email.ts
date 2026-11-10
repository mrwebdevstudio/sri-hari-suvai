import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type OrderEmailEvent = "order_confirmation" | "payment_success" | "order_processing" | "order_shipped" | "order_delivered" | "order_cancelled";

export async function sendOrderEmailEvent(
  event: OrderEmailEvent,
  payload: Record<string, unknown>,
): Promise<{ configured: boolean; delivered: boolean }> {
  const endpoint = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (!endpoint) return { configured: false, delivered: false };

  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret || !endpoint.startsWith("https://")) return {configured:false,delivered:false};
  const db=createAdminSupabaseClient();
  const {data:notice,error}=await db.rpc("claim_order_notice",{p_number:payload.orderNumber,p_event:event}).maybeSingle<{id:string;payload:Record<string,unknown>}>();
  if(error || !notice) return {configured:true,delivered:false};
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "Idempotency-Key":notice.id,
      },
      body: JSON.stringify({ event, ...notice.payload }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const {error:recordError}=await db.from("notification_outbox").update({state:response.ok?"delivered":"failed",updated_at:new Date().toISOString()}).eq("id",notice.id).eq("state","sending");
    if (recordError || !response.ok) logger.error("email.delivery_failed", { event, status: response.status });
    return { configured: true, delivered: response.ok };
  } catch {
    logger.error("email.delivery_failed", { event });
    return { configured: true, delivered: false };
  }
}
