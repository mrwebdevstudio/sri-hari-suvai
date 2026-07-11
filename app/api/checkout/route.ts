import { randomUUID } from "node:crypto";

import { sendOrderEmailEvent } from "@/lib/email";
import { getOptionalUser } from "@/lib/auth";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { calculateShippingPaise, generateOrderNumber } from "@/lib/orders";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { parseCheckoutInput } from "@/lib/validation";

export const runtime = "nodejs";
const NextResponse = { json: noStoreJson };

export async function POST(request: Request) {
  const rate = rateLimitRequest(request, "checkout-create", 12, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many checkout attempts. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = parseCheckoutInput(raw);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const input = parsed.data;
    const admin = createAdminSupabaseClient();
    const user = await getOptionalUser();
    const { data: settings } = await admin.from("store_settings").select("checkout_enabled, guest_checkout_enabled, product_ordering_enabled, flat_shipping_paise, free_shipping_threshold_paise, serviceable_postal_codes").eq("settings_key", "default").single();
    if (!settings?.checkout_enabled || !settings.product_ordering_enabled || settings.flat_shipping_paise === null) {
      return NextResponse.json({ error: "Online checkout is disabled until shipping is configured." }, { status: 503 });
    }
    if (!user && !settings.guest_checkout_enabled) return NextResponse.json({ error: "Sign in before checking out." }, { status: 401 });
    if (settings.serviceable_postal_codes?.length && !settings.serviceable_postal_codes.includes(input.postalCode)) {
      return NextResponse.json({ error: "Online delivery is not configured for this postal code." }, { status: 409 });
    }

    const requested = new Map<string, { productSlug: string; weightGrams: number; quantity: number }>();
    for (const item of input.items) {
      const key = `${item.productSlug}:${item.weightGrams}`;
      const previous = requested.get(key);
      const quantity = (previous?.quantity || 0) + item.quantity;
      if (quantity > 99) return NextResponse.json({ error: "A product quantity exceeds the allowed maximum." }, { status: 400 });
      requested.set(key, { ...item, quantity });
    }

    const slugs = [...new Set([...requested.values()].map((item) => item.productSlug))];
    const { data: catalogue, error: catalogueError } = await admin.from("products").select("id, slug, name, active, product_variants(id, weight_grams, price_paise, active, track_inventory, stock_quantity)").in("slug", slugs).eq("active", true);
    if (catalogueError) throw catalogueError;

    let subtotalPaise = 0;
    const snapshots: Record<string, unknown>[] = [];
    for (const item of requested.values()) {
      const product = catalogue?.find((entry) => entry.slug === item.productSlug && entry.active);
      const variant = product?.product_variants?.find((entry) => entry.weight_grams === item.weightGrams && entry.active);
      if (!product || !variant) return NextResponse.json({ error: "A cart item is unavailable or has changed." }, { status: 409 });
      if (variant.track_inventory && (variant.stock_quantity === null || variant.stock_quantity < item.quantity)) return NextResponse.json({ error: "A cart item does not have enough available stock." }, { status: 409 });
      const lineTotal = variant.price_paise * item.quantity;
      if (!Number.isSafeInteger(lineTotal)) return NextResponse.json({ error: "Cart total is invalid." }, { status: 400 });
      subtotalPaise += lineTotal;
      snapshots.push({ product_id: product.id, product_variant_id: variant.id, product_name: product.name, product_slug: product.slug, variant_name: `${variant.weight_grams} g`, weight_grams: variant.weight_grams, unit_price_paise: variant.price_paise, quantity: item.quantity });
    }
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) return NextResponse.json({ error: "Cart total is invalid." }, { status: 400 });
    const shippingPaise = calculateShippingPaise(subtotalPaise, settings.flat_shipping_paise, settings.free_shipping_threshold_paise);
    if (shippingPaise === null) return NextResponse.json({ error: "Shipping is not configured." }, { status: 503 });

    const { data: existing } = await admin.from("orders").select("id, order_number, email, phone, grand_total_paise, razorpay_order_id, payment_status").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existing && (existing.email !== input.email || existing.phone !== input.phone || existing.grand_total_paise !== subtotalPaise + shippingPaise)) return NextResponse.json({ error: "Checkout request conflicts with an existing order." }, { status: 409 });

    let order = existing;
    if (!order) {
      let createdId: string | null = null;
      let orderNumber = "";
      for (let attempt = 0; attempt < 4 && !createdId; attempt += 1) {
        orderNumber = generateOrderNumber();
        const { data, error } = await admin.rpc("create_pending_order", {
          p_order_number: orderNumber,
          p_user_id: user?.id || null,
          p_email: input.email,
          p_phone: input.phone,
          p_customer_name: input.name,
          p_address_snapshot: { name: input.name, phone: input.phone, addressLine1: input.addressLine1, addressLine2: input.addressLine2, city: input.city, state: input.state, postalCode: input.postalCode },
          p_customer_note: input.note,
          p_subtotal_paise: subtotalPaise,
          p_shipping_paise: shippingPaise,
          p_idempotency_key: input.idempotencyKey,
          p_items: snapshots,
        });
        if (!error) createdId = data;
        else if (error.message.toLowerCase().includes("idempotency")) {
          const { data: concurrent } = await admin.from("orders").select("id, order_number, email, phone, grand_total_paise, razorpay_order_id, payment_status").eq("idempotency_key", input.idempotencyKey).single();
          if (concurrent && concurrent.email === input.email && concurrent.phone === input.phone && concurrent.grand_total_paise === subtotalPaise + shippingPaise) order = concurrent;
          else throw error;
          break;
        } else if (!error.message.toLowerCase().includes("order_number")) throw error;
      }
      if (!createdId && !order) throw new Error("Could not generate a unique order number.");
      if (createdId) {
        order = { id: createdId, order_number: orderNumber, email: input.email, phone: input.phone, grand_total_paise: subtotalPaise + shippingPaise, razorpay_order_id: null, payment_status: "pending" };
        await sendOrderEmailEvent("order_confirmation", { orderNumber, email: input.email, amountPaise: subtotalPaise + shippingPaise }).catch(() => undefined);
      }
    }
    if (!order) throw new Error("Order creation failed.");
    if (order.payment_status === "paid") return NextResponse.json({ error: "This checkout request has already been paid." }, { status: 409 });

    let providerOrderId = order.razorpay_order_id;
    let keyId = getRazorpayKeyId();
    if (!providerOrderId) {
      const initializationToken = randomUUID();
      const { data: claimed, error: claimError } = await admin.rpc("claim_payment_initialization", { p_order_id: order.id, p_token: initializationToken });
      if (claimError) throw claimError;
      if (!claimed) {
        const { data: initialized } = await admin.from("orders").select("razorpay_order_id").eq("id", order.id).single();
        if (!initialized?.razorpay_order_id) return NextResponse.json({ error: "Payment is already being initialized. Retry shortly." }, { status: 409 });
        providerOrderId = initialized.razorpay_order_id;
      }
      try {
        if (claimed) {
          const providerOrder = await createRazorpayOrder({ amountPaise: order.grand_total_paise, orderNumber: order.order_number, customerEmail: input.email, customerPhone: input.phone });
          providerOrderId = providerOrder.id;
          keyId = providerOrder.keyId;
          const { data: finished, error } = await admin.rpc("finish_payment_initialization", { p_order_id: order.id, p_token: initializationToken, p_provider_order_id: providerOrderId });
          if (error || !finished) throw error || new Error("Payment initialization could not be saved.");
        }
      } catch (error) {
        await admin.rpc("finish_payment_initialization", { p_order_id: order.id, p_token: initializationToken, p_provider_order_id: "" });
        await admin.rpc("apply_payment_event", { p_order_id: order.id, p_provider_event_id: `checkout-failed:${order.id}`, p_event_type: "checkout.order_creation_failed", p_target_status: "failed", p_provider_payment_id: "", p_payload: { code: "provider_order_creation_failed" } });
        throw error;
      }
    }

    return NextResponse.json({ orderNumber: order.order_number, amountPaise: order.grand_total_paise, razorpayOrderId: providerOrderId, keyId });
  } catch (error) {
    logger.error("checkout.start_failed", { route: "/api/checkout", error });
    return NextResponse.json({ error: "Checkout could not be started. Try again later." }, { status: 500 });
  }
}
