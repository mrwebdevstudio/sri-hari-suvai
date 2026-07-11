import { isSafeHttpUrl } from "@/lib/admin";
import { getAdminUser } from "@/lib/auth";
import { sendOrderEmailEvent } from "@/lib/email";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isOrderStatus } from "@/lib/orders";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const NextResponse = { json: noStoreJson };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  if (!isOrderStatus(input.status)) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
  const trackingNumber = typeof input.trackingNumber === "string" ? input.trackingNumber.trim().slice(0, 100) : "";
  const courier = typeof input.courier === "string" ? input.courier.trim().slice(0, 100) : "";
  const trackingUrl = typeof input.trackingUrl === "string" ? input.trackingUrl.trim().slice(0, 500) : "";
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  const internalNote = typeof input.internalNote === "string" ? input.internalNote.trim().slice(0, 1000) : "";
  if (!isSafeHttpUrl(trackingUrl)) return NextResponse.json({ error: "Tracking URL must use http or https." }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin.from("orders").select("id, order_number, email, payment_status").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (["confirmed", "processing", "shipped", "delivered"].includes(input.status) && order.payment_status !== "paid") return NextResponse.json({ error: "Unpaid orders cannot enter fulfilment." }, { status: 409 });
  const { error } = await admin.rpc("admin_update_order_fulfillment", { p_order_id: id, p_admin_user_id: adminUser.id, p_status: input.status, p_tracking_number: trackingNumber, p_courier: courier, p_tracking_url: trackingUrl, p_customer_note: note, p_internal_note: internalNote, p_shipping_date: null, p_correlation_id: null });
  if (error) { logger.error("admin.order_api_update_failed", { orderId: id, error }); return NextResponse.json({ error: "Order update failed." }, { status: 500 }); }
  if (input.status === "shipped") await sendOrderEmailEvent("order_shipped", { orderNumber: order.order_number, email: order.email, courier, trackingNumber }).catch(() => undefined);
  return NextResponse.json({ updated: true });
}
