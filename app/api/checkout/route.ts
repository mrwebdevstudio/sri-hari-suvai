import { randomUUID } from "node:crypto";
import { checkoutMatchesOrder, type OrderItemSnapshot } from "@/lib/checkout-retry";
import { createOrderReceipt, ORDER_RECEIPT_COOKIE, ORDER_RECEIPT_SECONDS } from "@/lib/order-receipt";

import { sendOrderEmailEvent } from "@/lib/email";
import { getOptionalUser } from "@/lib/auth";
import { noStoreJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { acceptsQuote, calculateCheckoutQuote, servesPostalCode } from "@/lib/checkout-pricing";
import { generateOrderNumber } from "@/lib/orders";
import { rateLimitRequest } from "@/lib/rate-limit";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/razorpay";
import { createAdminSupabaseClient, hasSupabaseServerKey } from "@/lib/supabase/admin";
import { parseCheckoutInput } from "@/lib/validation";

export const runtime = "nodejs";
const NextResponse = { json: noStoreJson };
const retryOrderFields = "id, order_number, user_id, email, phone, customer_name, customer_note, address_snapshot, subtotal_paise, shipping_paise, tax_paise, discount_paise, grand_total_paise, razorpay_order_id, payment_status, status, inventory_reservations(released_at), order_items(product_slug, weight_grams, quantity, unit_price_paise)";

export async function POST(request: Request) {
  const rate = rateLimitRequest(request, "checkout-create", 12, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many checkout attempts. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = parseCheckoutInput(raw);
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const input = parsed.data;
    if (!hasSupabaseServerKey()) return NextResponse.json({error:"Online checkout is not configured."},{status:503});
    const admin = createAdminSupabaseClient();
    const user = await getOptionalUser();
    const { data: settings } = await admin.from("store_settings").select("checkout_enabled, guest_checkout_enabled, product_ordering_enabled, flat_shipping_paise, free_shipping_threshold_paise, shipping_coverage, serviceable_postal_codes, tax_mode, tax_rate_bps, tax_shipping, discount_mode, gstin, fssai_license_number").eq("settings_key", "default").single();
    if (!settings?.checkout_enabled || !settings.product_ordering_enabled || settings.flat_shipping_paise === null) {
      return NextResponse.json({ error: "Online checkout is disabled until shipping is configured." }, { status: 503 });
    }
    if (process.env.COMMERCE_ENVIRONMENT === "production" && (!settings.gstin || !settings.fssai_license_number)) {
      return NextResponse.json({ error: "Store registration approval is pending." }, { status: 503 });
    }
    if (!user && !settings.guest_checkout_enabled) return NextResponse.json({ error: "Sign in before checking out." }, { status: 401 });
    if (!servesPostalCode(settings.shipping_coverage, settings.serviceable_postal_codes, input.postalCode)) {
      return NextResponse.json({ error: "Online delivery is not configured for this postal code." }, { status: 409 });
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) return NextResponse.json({ error: "Online payments are temporarily unavailable." }, { status: 503 });
    // Validate provider configuration before creating a pending order.
    const configuredKeyId = getRazorpayKeyId();

    const requested = new Map<string, (typeof input.items)[number]>();
    for (const item of input.items) {
      const key = `${item.productSlug}:${item.weightGrams}`;
      const previous = requested.get(key);
      if (previous && previous.expectedUnitPricePaise !== item.expectedUnitPricePaise) return NextResponse.json({ error: "Inconsistent cart prices." }, { status: 409 });
      const quantity = (previous?.quantity || 0) + item.quantity;
      if (quantity > 99) return NextResponse.json({ error: "A product quantity exceeds the allowed maximum." }, { status: 400 });
      requested.set(key, { ...item, quantity });
    }

    const slugs = [...new Set([...requested.values()].map((item) => item.productSlug))];
    const { data: catalogue, error: catalogueError } = await admin.from("products").select("id, slug, name, active, product_variants(id, weight_grams, price_paise, active, track_inventory, stock_quantity)").in("slug", slugs).eq("active", true);
    if (catalogueError) throw catalogueError;

    let subtotalPaise = 0;
    const snapshots: (OrderItemSnapshot & Record<string, unknown>)[] = [];
    for (const item of requested.values()) {
      const product = catalogue?.find((entry) => entry.slug === item.productSlug && entry.active);
      const variant = product?.product_variants?.find((entry) => entry.weight_grams === item.weightGrams && entry.active);
      if (!product || !variant) return NextResponse.json({ error: "A cart item is unavailable or has changed." }, { status: 409 });
      if (item.expectedUnitPricePaise !== variant.price_paise) return NextResponse.json({ error: "Cart prices changed. Refresh your cart.", code: "checkout_changed" }, { status: 409 });
      if (!variant.track_inventory || variant.stock_quantity === null || variant.stock_quantity < item.quantity) return NextResponse.json({ error: "A cart item does not have enough available stock." }, { status: 409 });
      const lineTotal = variant.price_paise * item.quantity;
      if (!Number.isSafeInteger(lineTotal)) return NextResponse.json({ error: "Cart total is invalid." }, { status: 400 });
      subtotalPaise += lineTotal;
      snapshots.push({ product_id: product.id, product_variant_id: variant.id, product_name: product.name, product_slug: product.slug, variant_name: `${variant.weight_grams} g`, weight_grams: variant.weight_grams, unit_price_paise: variant.price_paise, quantity: item.quantity });
    }
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise <= 0) return NextResponse.json({ error: "Cart total is invalid." }, { status: 400 });
    const quote = calculateCheckoutQuote(subtotalPaise, {
      flatShippingPaise: settings.flat_shipping_paise, freeShippingThresholdPaise: settings.free_shipping_threshold_paise,
      taxMode: settings.tax_mode, taxRateBps: settings.tax_rate_bps, taxShipping: settings.tax_shipping, discountMode: settings.discount_mode,
    });
    if (!quote) return NextResponse.json({ error: "Checkout pricing is unavailable." }, { status: 503 });
    if (!acceptsQuote((raw as Record<string, unknown>).expectedQuote, quote)) {
      return NextResponse.json({ error: "Totals changed. Refresh and review checkout.", code: "checkout_changed" }, { status: 409 });
    }
    const { shippingPaise, taxPaise, discountPaise } = quote;

    const { data: existing, error: existingError } = await admin.from("orders").select(retryOrderFields).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existingError) throw existingError;
    if (existing && !checkoutMatchesOrder(existing, input, user?.id || null, snapshots, subtotalPaise, shippingPaise, taxPaise, discountPaise)) return NextResponse.json({ error: "Your cart or delivery details changed. Start a new checkout attempt.", code: "checkout_changed" }, { status: 409 });

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
          p_tax_paise: taxPaise,
          p_discount_paise: discountPaise,
          p_idempotency_key: input.idempotencyKey,
          p_items: [...snapshots].sort((a,b)=>String(a.product_variant_id).localeCompare(String(b.product_variant_id))),
        });
        if (!error) createdId = data;
        else if (error.code === "SH003") return NextResponse.json({error:"Online checkout is unavailable."},{status:503});
        else if (error.code === "SH004") return NextResponse.json({error:"Delivery or totals changed. Review checkout."},{status:409});
        else if (["SH001","SH002","P0002"].includes(error.code)) return NextResponse.json({error:"Pack availability or price changed. Review your cart."},{status:409});
        else if (error.message.toLowerCase().includes("idempotency")) {
          const { data: concurrent, error: concurrentError } = await admin.from("orders").select(retryOrderFields).eq("idempotency_key", input.idempotencyKey).single();
          if (concurrentError) throw concurrentError;
          if (!checkoutMatchesOrder(concurrent, input, user?.id || null, snapshots, subtotalPaise, shippingPaise, taxPaise, discountPaise)) return NextResponse.json({ error: "Your cart or delivery details changed. Start a new checkout attempt.", code: "checkout_changed" }, { status: 409 });
          order = concurrent;
          break;
        } else if (!error.message.toLowerCase().includes("order_number")) throw error;
      }
      if (!createdId && !order) throw new Error("Could not generate a unique order number.");
      if (createdId) {
        const { data: created, error } = await admin.from("orders").select(retryOrderFields).eq("id", createdId).single();
        if (error) throw error;
        order = created;
        await sendOrderEmailEvent("order_confirmation", { orderNumber, email: input.email, amountPaise: quote.grandTotalPaise }).catch(() => undefined);
      }
    }
    if (!order) throw new Error("Order creation failed.");
    if (order.inventory_reservations.some((hold: { released_at: string | null }) => hold.released_at) || order.payment_status === "paid" || order.payment_status === "refunded" || order.status === "cancelled") return NextResponse.json({ error: "This order cannot be paid again. Check its current status before placing another order.", code: "checkout_closed" }, { status: 409 });

    let providerOrderId = order.razorpay_order_id;
    let keyId = configuredKeyId;
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
        // A network failure can follow a successful provider POST. Keep payment pending for receipt reconciliation.
        await admin.rpc("finish_payment_initialization", { p_order_id: order.id, p_token: initializationToken, p_provider_order_id: "" });
        throw error;
      }
    }

    const response = NextResponse.json({ orderNumber: order.order_number, amountPaise: order.grand_total_paise, razorpayOrderId: providerOrderId, keyId });
    response.cookies.set(ORDER_RECEIPT_COOKIE, createOrderReceipt(order.order_number, process.env.RAZORPAY_KEY_SECRET?.trim() || ""), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/order-confirmation", maxAge: ORDER_RECEIPT_SECONDS,
    });
    return response;
  } catch (error) {
    logger.error("checkout.start_failed", { route: "/api/checkout", error });
    return NextResponse.json({ error: "Checkout could not be started. Try again later." }, { status: 500 });
  }
}
