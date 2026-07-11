import { calculateVerifiedRevenue } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const ADMIN_PAGE_SIZE = 25;

export type AdminOrderFilters = {
  query?: string;
  payment?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
};

function safeSearch(value = ""): string {
  return value.trim().slice(0, 100).replace(/[%_,()]/g, "");
}

export async function getDashboardData() {
  const admin = createAdminSupabaseClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const count = (column: string, value: string) => admin.from("orders").select("id", { count: "exact", head: true }).eq(column, value);
  const [
    ordersToday, awaiting, processing, packed, shipped, outForDelivery, delivered,
    failed, recent, paidOrders, lowStock, inactiveProducts, inactiveVariants, settings,
  ] = await Promise.all([
    admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("status", "confirmed"),
    count("status", "processing"),
    count("status", "packed"),
    count("status", "shipped"),
    count("status", "out_for_delivery"),
    count("status", "delivered"),
    count("payment_status", "failed"),
    admin.from("orders").select("id, order_number, customer_name, grand_total_paise, payment_status, status, created_at").order("created_at", { ascending: false }).limit(8),
    admin.from("orders").select("payment_status, grand_total_paise, refunded_paise").in("payment_status", ["paid", "refunded"]).gte("created_at", thirtyDaysAgo).limit(5000),
    admin.from("product_variants").select("id, weight_grams, stock_quantity, products(name), updated_at").eq("track_inventory", true).order("stock_quantity", { ascending: true }).limit(10),
    admin.from("products").select("id", { count: "exact", head: true }).eq("active", false),
    admin.from("product_variants").select("id", { count: "exact", head: true }).eq("active", false),
    admin.from("store_settings").select("checkout_enabled, flat_shipping_paise, low_stock_threshold").eq("settings_key", "default").single(),
  ]);
  const revenue = calculateVerifiedRevenue(paidOrders.data || []);
  const threshold = settings.data?.low_stock_threshold;
  return {
    metrics: {
      ordersToday: ordersToday.count || 0,
      awaiting: awaiting.count || 0,
      processing: processing.count || 0,
      packed: packed.count || 0,
      shipped: shipped.count || 0,
      outForDelivery: outForDelivery.count || 0,
      delivered: delivered.count || 0,
      failed: failed.count || 0,
      ...revenue,
    },
    recentOrders: recent.data || [],
    lowStock: threshold === null || threshold === undefined
      ? []
      : (lowStock.data || []).filter((variant) => Number(variant.stock_quantity) <= threshold),
    inactiveCount: (inactiveProducts.count || 0) + (inactiveVariants.count || 0),
    settings: settings.data,
    configuration: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET),
    },
  };
}

export async function getAdminOrders(filters: AdminOrderFilters) {
  const admin = createAdminSupabaseClient();
  const page = Math.max(1, Number.isInteger(filters.page) ? Number(filters.page) : 1);
  const fromRow = (page - 1) * ADMIN_PAGE_SIZE;
  let query = admin
    .from("orders")
    .select("id, order_number, customer_name, phone, email, grand_total_paise, payment_status, status, created_at, order_items(count)", { count: "exact" });
  const search = safeSearch(filters.query);
  if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  if (filters.payment) query = query.eq("payment_status", filters.payment);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(fromRow, fromRow + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  return { orders: data || [], total: count || 0, page, pageCount: Math.max(1, Math.ceil((count || 0) / ADMIN_PAGE_SIZE)) };
}

export async function getAdminOrder(orderNumber: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("orders")
    .select("*, order_items(*), order_status_history(*), payment_events(id, event_type, provider_event_id, provider_payment_id, resulting_status, amount_paise, currency, signature_verified, capture_status, provider_refund_id, created_at)")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: auditLogs } = await admin.from("audit_logs").select("id, event_type, summary, metadata, created_at, actor_user_id").eq("entity_type", "order").eq("entity_id", orderNumber).order("created_at", { ascending: false }).limit(50);
  return { ...data, audit_logs: auditLogs || [] };
}

export async function getAdminProducts() {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("products").select("*, product_variants(*)").order("sort_order").order("name");
  if (error) throw error;
  return data || [];
}

export async function getAdminProduct(id: string) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("products").select("*, product_variants(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getInventoryData() {
  const admin = createAdminSupabaseClient();
  const [{ data: variants, error }, { data: settings }, { data: adjustments }] = await Promise.all([
    admin.from("product_variants").select("*, products(name, slug)").eq("track_inventory", true).order("stock_quantity"),
    admin.from("store_settings").select("low_stock_threshold").eq("settings_key", "default").single(),
    admin.from("inventory_adjustments").select("id, product_variant_id, adjustment_delta, before_quantity, after_quantity, reason, created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  if (error) throw error;
  return { variants: variants || [], threshold: settings?.low_stock_threshold ?? null, adjustments: adjustments || [] };
}

export async function getAdminSettings() {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("store_settings").select("*").eq("settings_key", "default").single();
  if (error) throw error;
  return data;
}

export async function getAnalyticsData(from: string, to: string) {
  const admin = createAdminSupabaseClient();
  const [{ data: orders, error }, { data: items }] = await Promise.all([
    admin.from("orders").select("id, user_id, payment_status, status, grand_total_paise, shipping_paise, refunded_paise, created_at").gte("created_at", from).lte("created_at", to).order("created_at").limit(5000),
    admin.from("order_items").select("order_id, product_name, variant_name, quantity, line_total_paise, orders!inner(payment_status, created_at)").gte("orders.created_at", from).lte("orders.created_at", to).in("orders.payment_status", ["paid", "refunded"]).limit(10000),
  ]);
  if (error) throw error;
  const orderRows = orders || [];
  const revenue = calculateVerifiedRevenue(orderRows);
  const byDay = new Map<string, { orders: number; revenuePaise: number }>();
  const byMonth = new Map<string, { orders: number; revenuePaise: number }>();
  const fulfilment = new Map<string, number>();
  for (const order of orderRows) {
    const day = String(order.created_at).slice(0, 10);
    const row = byDay.get(day) || { orders: 0, revenuePaise: 0 };
    row.orders += 1;
    if (order.payment_status === "paid" || order.payment_status === "refunded") row.revenuePaise += order.grand_total_paise - (order.refunded_paise || 0);
    byDay.set(day, row);
    const month = day.slice(0, 7);
    const monthRow = byMonth.get(month) || { orders: 0, revenuePaise: 0 };
    monthRow.orders += 1;
    if (order.payment_status === "paid" || order.payment_status === "refunded") monthRow.revenuePaise += order.grand_total_paise - (order.refunded_paise || 0);
    byMonth.set(month, monthRow);
    fulfilment.set(order.status, (fulfilment.get(order.status) || 0) + 1);
  }
  const products = new Map<string, { units: number; revenuePaise: number }>();
  const variants = new Map<string, { units: number; revenuePaise: number }>();
  for (const item of items || []) {
    const product = products.get(item.product_name) || { units: 0, revenuePaise: 0 };
    product.units += item.quantity; product.revenuePaise += item.line_total_paise; products.set(item.product_name, product);
    const variant = variants.get(item.variant_name) || { units: 0, revenuePaise: 0 };
    variant.units += item.quantity; variant.revenuePaise += item.line_total_paise; variants.set(item.variant_name, variant);
  }
  return {
    revenue,
    totalOrders: orderRows.length,
    failedPayments: orderRows.filter((order) => order.payment_status === "failed").length,
    shippingCollectedPaise: orderRows.filter((order) => ["paid", "refunded"].includes(order.payment_status)).reduce((sum, order) => sum + order.shipping_paise, 0),
    guestOrders: orderRows.filter((order) => !order.user_id).length,
    authenticatedOrders: orderRows.filter((order) => order.user_id).length,
    byDay: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
    byMonth: [...byMonth.entries()].map(([month, value]) => ({ month, ...value })),
    fulfilment: [...fulfilment.entries()].map(([status, count]) => ({ status, count })),
    products: [...products.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenuePaise - a.revenuePaise),
    variants: [...variants.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.revenuePaise - a.revenuePaise),
  };
}

export async function getAuditLogs(filters: { event?: string; actor?: string; entity?: string; from?: string; to?: string; page?: number }) {
  const admin = createAdminSupabaseClient();
  const page = Math.max(1, Number(filters.page) || 1);
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  let query = admin.from("audit_logs").select("id, actor_user_id, actor_role, event_type, entity_type, entity_id, summary, metadata, correlation_id, created_at", { count: "exact" });
  if (filters.event) query = query.eq("event_type", filters.event.slice(0, 100));
  if (filters.actor) query = query.eq("actor_user_id", filters.actor.slice(0, 36));
  if (filters.entity) query = query.ilike("entity_id", `%${safeSearch(filters.entity)}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(start, start + ADMIN_PAGE_SIZE - 1);
  if (error) throw error;
  return { logs: data || [], total: count || 0, page, pageCount: Math.max(1, Math.ceil((count || 0) / ADMIN_PAGE_SIZE)) };
}
