"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import {
  isKnownOrderStatus,
  isSafeHttpUrl,
  isValidFulfilmentTransition,
  parseNonNegativeRupeesToPaise,
  parseProductUpdate,
  parseRupeesToPaise,
} from "@/lib/admin";
import { getAdminUser } from "@/lib/auth";
import { sendOrderEmailEvent, type OrderEmailEvent } from "@/lib/email";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPhone, normalizePhone } from "@/lib/validation";

function value(formData: FormData, key: string, maximum = 500): string {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim().slice(0, maximum) : "";
}

function withMessage(path: string, key: "error" | "message", message: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}

async function adminContext(path: string) {
  const user = await getAdminUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  const rate = checkRateLimit(`admin-mutation:${user.id}`, 60, 60_000);
  if (!rate.allowed) redirect(withMessage(path, "error", "Too many updates. Wait briefly and try again."));
  return { user, admin: createAdminSupabaseClient() };
}

function mutationFailure(path: string, event: string, error: unknown): never {
  logger.error(event, { error });
  redirect(withMessage(path, "error", "The update could not be saved. Review the values and try again."));
}

export async function createProductAction(form: FormData) {
  const path = "/admin/products";
  const {admin,user} = await adminContext(path);
  const prices = [100,250,500,1000].map(weight => parseRupeesToPaise(form.get("price"+weight)));
  if (prices.some(price => price === null || price <= 0)) redirect(withMessage(path,"error","Enter a positive price for each pack."));
  const {data,error} = await admin.rpc("admin_create_product",{p_actor:user.id,p_slug:value(form,"slug",100),p_name:value(form,"name",150),p_category:value(form,"category",30),p_prices:prices});
  if (error) mutationFailure(path,"admin.product_create_failed",error);
  updateTag("catalogue");
  redirect("/admin/products/"+data);
}

export async function changeProductImageAction(form: FormData) {
  const id=value(form,"id",36);
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/admin/products");
  const path="/admin/products/"+id;
  const {admin,user}=await adminContext(path);
  const bucket=admin.storage.from("product-images");
  let objectName: string | null=null;
  if(form.get("operation")!=="remove") {
    const file=form.get("image");
    if (!(file instanceof File) || !file.size || file.size>4*1024*1024) redirect(withMessage(path,"error","Choose a PNG, JPEG or WebP under 4 MB."));
    const bytes=Buffer.from(await file.arrayBuffer());
    const ext = file.type==="image/png" && bytes.subarray(0,8).toString("hex")==="89504e470d0a1a0a" ? "png"
      : file.type==="image/jpeg" && bytes.subarray(0,3).toString("hex")==="ffd8ff" ? "jpg"
      : file.type==="image/webp" && bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP" ? "webp" : null;
    if(!ext) redirect(withMessage(path,"error","The file contents do not match a supported image type."));
    objectName=id+"/"+randomUUID()+"."+ext;
    const session=await createServerSupabaseClient();
    const {error}=await session.storage.from("product-images").upload(objectName,bytes,{contentType:file.type,cacheControl:"60",upsert:false});
    if(error) mutationFailure(path,"admin.media_upload_failed",error);
  }
  const {data:previous,error}=await admin.rpc("admin_set_product_image",{p_actor:user.id,p_product:id,p_object:objectName});
  if(error) {
    // A transport failure can mask a committed swap. Never delete the new object on an ambiguous result.
    mutationFailure(path,"admin.media_publish_failed",error);
  }
  if(previous && previous!==objectName) {
    const {error:cleanup}=await bucket.remove([previous]);
    if(cleanup) logger.warn("admin.media_cleanup_pending",{productId:id});
  }
  updateTag("catalogue");
  redirect(withMessage(path,"message","Product image updated."));
}

export async function updateProductAction(formData: FormData) {
  const id = value(formData, "id", 36);
  const path = `/admin/products/${id}`;
  const parsed = parseProductUpdate(formData);
  if (!parsed.data) redirect(withMessage(path, "error", parsed.error || "Invalid product details."));
  const { user, admin } = await adminContext(path);
  try {
    const { data: current } = await admin.from("products").select("id").eq("id", id).single();
    if (!current) redirect(withMessage("/admin/products", "error", "Product not found."));
    const update = parsed.data;
    const { error } = await admin.rpc("admin_update_product", {
      p_product_id: id,
      p_admin_user_id: user.id,
      p_name: update.name,
      p_category: update.category,
      p_summary: update.summary,
      p_usage: update.usage,
      p_image_path: update.imagePath || "",
      p_sort_order: update.sortOrder,
      p_active: update.active,
      p_correlation_id: null,
    });
    if (error) throw error;
    updateTag("catalogue");
  } catch (error) {
    mutationFailure(path, "admin.product_update_failed", error);
  }
  redirect(withMessage(path, "message", "Product saved."));
}

export async function updateVariantAction(formData: FormData) {
  const id = value(formData, "id", 36);
  const productId = value(formData, "productId", 36);
  const path = `/admin/products/${productId}`;
  const weightGrams = Number(value(formData, "weightGrams", 10));
  const pricePaise = parseRupeesToPaise(value(formData, "priceRupees", 20));
  const active = formData.get("active") === "on";
  const trackInventory = formData.get("trackInventory") === "on";
  const stockText = value(formData, "stockQuantity", 12);
  const stockQuantity = trackInventory ? Number(stockText) : null;
  const reason = value(formData, "reason", 500);
  if (!Number.isInteger(weightGrams) || weightGrams <= 0 || pricePaise === null) redirect(withMessage(path, "error", "Weight and price must be positive values."));
  if (trackInventory && (!Number.isInteger(stockQuantity) || Number(stockQuantity) < 0)) redirect(withMessage(path, "error", "Tracked stock must be a non-negative whole number."));
  const { user, admin } = await adminContext(path);
  try {
    const { data: current } = await admin.from("product_variants").select("id, product_id, weight_grams, price_paise, active, track_inventory, stock_quantity").eq("id", id).eq("product_id", productId).single();
    if (!current) redirect(withMessage(path, "error", "Variant not found."));
    if (current.active && !active && formData.get("confirmDeactivate") !== "on") {
      redirect(withMessage(path, "error", "Confirm variant deactivation before saving."));
    }
    const stockChanged = current.stock_quantity !== stockQuantity;
    if (stockChanged && reason.length < 3) redirect(withMessage(path, "error", "Give a reason for the stock or inventory-tracking change."));
    const { error } = await admin.rpc("admin_update_variant", {
      p_variant_id: id,
      p_admin_user_id: user.id,
      p_weight_grams: weightGrams,
      p_price_paise: pricePaise,
      p_active: active,
      p_track_inventory: trackInventory,
      p_stock_quantity: stockQuantity,
      p_reason: reason,
      p_correlation_id: null,
    });
    if (error) throw error;
    updateTag("catalogue");
  } catch (error) {
    mutationFailure(path, "admin.variant_update_failed", error);
  }
  redirect(withMessage(path, "message", "Variant saved."));
}

export async function adjustInventoryAction(formData: FormData) {
  const id = value(formData, "variantId", 36);
  const delta = Number(value(formData, "delta", 12));
  const reason = value(formData, "reason", 500);
  const path = "/admin/inventory";
  if (!Number.isInteger(delta) || delta === 0 || reason.length < 3) redirect(withMessage(path, "error", "Enter a non-zero whole-number adjustment and a reason."));
  const { user, admin } = await adminContext(path);
  const { error } = await admin.rpc("admin_adjust_inventory", {
    p_product_variant_id: id,
    p_admin_user_id: user.id,
    p_delta: delta,
    p_reason: reason,
    p_correlation_id: null,
  });
  if (error) mutationFailure(path, "admin.inventory_adjustment_failed", error);
  redirect(withMessage(path, "message", "Stock adjusted."));
}

export async function updateOrderAction(formData: FormData) {
  const orderId = value(formData, "orderId", 36);
  const orderNumber = value(formData, "orderNumber", 30);
  const path = `/admin/orders/${encodeURIComponent(orderNumber)}`;
  const status = value(formData, "status", 40);
  const trackingNumber = value(formData, "trackingNumber", 100);
  const courier = value(formData, "courier", 100);
  const trackingUrl = value(formData, "trackingUrl", 500);
  const customerNote = value(formData, "customerNote", 500);
  const internalNote = value(formData, "internalNote", 1000);
  const shippingDate = value(formData, "shippingDate", 40);
  if (!isKnownOrderStatus(status) || !isSafeHttpUrl(trackingUrl)) redirect(withMessage(path, "error", "Select a valid status and use an http or https tracking URL."));
  const { user, admin } = await adminContext(path);
  try {
    const { data: current } = await admin.from("orders").select("status, payment_status, email").eq("id", orderId).single();
    if (!current || !isKnownOrderStatus(current.status)) redirect(withMessage(path, "error", "Order not found."));
    if (!isValidFulfilmentTransition(current.status, status)) redirect(withMessage(path, "error", `The order cannot move from ${current.status} to ${status}.`));
    if (["confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered"].includes(status) && current.payment_status !== "paid") {
      redirect(withMessage(path, "error", "Unpaid or failed orders cannot be fulfilled."));
    }
    const parsedShippingDate = shippingDate ? new Date(shippingDate) : null;
    if (parsedShippingDate && Number.isNaN(parsedShippingDate.valueOf())) redirect(withMessage(path, "error", "Shipping date is invalid."));
    const { error } = await admin.rpc("admin_update_order_fulfillment", {
      p_order_id: orderId,
      p_admin_user_id: user.id,
      p_status: status,
      p_tracking_number: trackingNumber,
      p_courier: courier,
      p_tracking_url: trackingUrl,
      p_customer_note: customerNote,
      p_internal_note: internalNote,
      p_shipping_date: parsedShippingDate?.toISOString() || null,
      p_correlation_id: null,
    });
    if (error) throw error;
    if (status !== current.status) {
      const eventByStatus: Partial<Record<typeof status, OrderEmailEvent>> = {
        processing: "order_processing",
        shipped: "order_shipped",
        delivered: "order_delivered",
        cancelled: "order_cancelled",
      };
      const event = eventByStatus[status];
      if (event) {
        const { data: settings } = await admin.from("store_settings").select("order_email_hook_enabled, shipping_email_hook_enabled").eq("settings_key", "default").single();
        const enabled = event === "order_shipped" ? settings?.shipping_email_hook_enabled : settings?.order_email_hook_enabled;
        if (enabled) await sendOrderEmailEvent(event, { orderNumber, email: current.email, courier, trackingNumber, trackingUrl }).catch((error) => logger.warn("order.email_hook_failed", { orderNumber, error }));
      }
    }
  } catch (error) {
    mutationFailure(path, "admin.order_update_failed", error);
  }
  redirect(withMessage(path, "message", "Order updated."));
}

function optionalMoney(formData: FormData, key: string): number | null | "invalid" {
  const raw = value(formData, key, 20);
  if (!raw) return null;
  return parseNonNegativeRupeesToPaise(raw) ?? "invalid";
}

export async function updateSettingsAction(formData: FormData) {
  const path = "/admin/settings";
  const flatShippingPaise = optionalMoney(formData, "flatShippingRupees");
  const freeShippingThresholdPaise = optionalMoney(formData, "freeShippingThresholdRupees");
  const primaryPhone = normalizePhone(formData.get("primaryPhone"));
  const secondaryPhone = normalizePhone(formData.get("secondaryPhone"));
  const whatsappNumber = normalizePhone(formData.get("whatsappNumber"));
  const lowStockText = value(formData, "lowStockThreshold", 10);
  const lowStockThreshold = lowStockText ? Number(lowStockText) : null;
  const serviceablePostalCodes = [...new Set(value(formData, "serviceablePostalCodes", 4000).split(/[\s,]+/).filter(Boolean))];
  if (flatShippingPaise === "invalid" || freeShippingThresholdPaise === "invalid") redirect(withMessage(path, "error", "Money values must be non-negative rupee amounts with at most two decimals."));
  if ([primaryPhone, secondaryPhone, whatsappNumber].some((phone) => phone && !isValidPhone(phone))) redirect(withMessage(path, "error", "Enter valid phone numbers."));
  if (lowStockThreshold !== null && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)) redirect(withMessage(path, "error", "Low-stock threshold must be a non-negative whole number."));
  if (serviceablePostalCodes.some((code) => !/^[1-9]\d{5}$/.test(code))) redirect(withMessage(path, "error", "Serviceable postal codes must be six-digit Indian PIN codes."));
  const checkoutEnabled = formData.get("checkoutEnabled") === "on";
  if (checkoutEnabled && flatShippingPaise === null) redirect(withMessage(path, "error", "Configure flat shipping before enabling checkout."));
  const updates = {
    checkout_enabled: checkoutEnabled,
    guest_checkout_enabled: formData.get("guestCheckoutEnabled") === "on",
    product_ordering_enabled: formData.get("productOrderingEnabled") === "on",
    flat_shipping_paise: flatShippingPaise,
    free_shipping_threshold_paise: freeShippingThresholdPaise,
    shipping_notice: value(formData, "shippingNotice") || null,
    business_phone: primaryPhone || null,
    secondary_phone: secondaryPhone || null,
    whatsapp_number: whatsappNumber || null,
    business_address: value(formData, "businessAddress") || null,
    serviceable_postal_codes: serviceablePostalCodes.length ? serviceablePostalCodes : null,
    low_stock_threshold: lowStockThreshold,
    order_email_hook_enabled: formData.get("orderEmailHookEnabled") === "on",
    shipping_email_hook_enabled: formData.get("shippingEmailHookEnabled") === "on",
    maintenance_notice: value(formData, "maintenanceNotice") || null,
    policies_approved: formData.get("policiesApproved") === "on",
  };
  const { user, admin } = await adminContext(path);
  try {
    const { error } = await admin.rpc("admin_update_store_settings", { p_admin_user_id: user.id, p_updates: updates, p_correlation_id: null });
    if (error) throw error;
  } catch (error) {
    mutationFailure(path, "admin.settings_update_failed", error);
  }
  redirect(withMessage(path, "message", "Store settings saved."));
}
