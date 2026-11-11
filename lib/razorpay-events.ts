function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function readRazorpayEvent(input: unknown) {
  const body = record(input);
  if (typeof body.event !== "string" || !body.event) return { kind: "invalid" } as const;
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
  if (!targetStatus) return { kind: "ignored" } as const;

  const isRefund = targetStatus === "refunded";
  const entity = isRefund ? refund : payment;
  const providerPaymentId = isRefund ? refund.payment_id : payment.id;
  const providerOrderId = payment.order_id || providerOrder.id;
  const eventAmount = entity.amount;
  const eventCurrency = entity.currency;
  if (typeof providerPaymentId !== "string" || !providerPaymentId ||
      (!isRefund && (typeof providerOrderId !== "string" || !providerOrderId)) ||
      (payment.order_id && providerOrder.id && payment.order_id !== providerOrder.id) ||
      (isRefund && (typeof refund.id !== "string" || !refund.id || refund.status !== "processed" ||
        (payment.id && payment.id !== providerPaymentId))) ||
      (targetStatus === "paid" && payment.status !== "captured") ||
      (targetStatus === "failed" && payment.status !== "failed") ||
      typeof eventAmount !== "number" || !Number.isSafeInteger(eventAmount) || eventAmount <= 0 || eventCurrency !== "INR") {
    return { kind: "invalid" } as const;
  }
  return { kind: "recognized", eventType, targetStatus, providerPaymentId, providerOrderId,
    eventAmount, eventCurrency, captureStatus: String(payment.status || ""), refundId: String(refund.id || "") } as const;
}
