export type OrderEmailEvent = "order_confirmation" | "payment_success" | "order_processing" | "order_shipped" | "order_delivered" | "order_cancelled";

export async function sendOrderEmailEvent(
  event: OrderEmailEvent,
  payload: Record<string, unknown>,
): Promise<{ configured: boolean; delivered: boolean }> {
  const endpoint = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (!endpoint) return { configured: false, delivered: false };

  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ event, ...payload }),
    cache: "no-store",
  });
  return { configured: true, delivered: response.ok };
}
