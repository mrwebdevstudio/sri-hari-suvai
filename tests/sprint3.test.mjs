import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateVerifiedRevenue,
  isSafeHttpUrl,
  isSafeProductImagePath,
  isValidFulfilmentTransition,
  parseProductUpdate,
  parseRupeesToPaise,
} from "../lib/admin.ts";

test("admin money parsing persists exact positive integer paise", () => {
  assert.equal(parseRupeesToPaise("125"), 12_500);
  assert.equal(parseRupeesToPaise("125.05"), 12_505);
  assert.equal(parseRupeesToPaise("0"), null);
  assert.equal(parseRupeesToPaise("12.345"), null);
  assert.equal(parseRupeesToPaise("-1"), null);
});

test("fulfilment transitions block skips, rollbacks and terminal changes", () => {
  assert.equal(isValidFulfilmentTransition("confirmed", "processing"), true);
  assert.equal(isValidFulfilmentTransition("processing", "packed"), true);
  assert.equal(isValidFulfilmentTransition("packed", "shipped"), true);
  assert.equal(isValidFulfilmentTransition("shipped", "out_for_delivery"), true);
  assert.equal(isValidFulfilmentTransition("out_for_delivery", "delivered"), true);
  assert.equal(isValidFulfilmentTransition("confirmed", "delivered"), false);
  assert.equal(isValidFulfilmentTransition("delivered", "processing"), false);
  assert.equal(isValidFulfilmentTransition("cancelled", "shipped"), false);
});

test("tracking URLs and controlled product image paths reject unsafe schemes and traversal", () => {
  assert.equal(isSafeHttpUrl("https://carrier.example/track/1"), true);
  assert.equal(isSafeHttpUrl("http://carrier.example/track/1"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeProductImagePath("/images/products/sambar-podi.png"), true);
  assert.equal(isSafeProductImagePath("/images/products/../../secret.png"), false);
  assert.equal(isSafeProductImagePath("https://example.test/product.png"), false);
});

function validProductForm() {
  const form = new FormData();
  form.set("name", "Sambar Podi");
  form.set("category", "Instant Mix");
  form.set("summary", "Summary");
  form.set("usage", "Usage");
  form.set("imagePath", "/images/products/sambar-podi.png");
  form.set("sortOrder", "1");
  form.set("active", "on");
  return form;
}

test("product validation rejects empty names, invalid categories and unsafe images", () => {
  const valid = validProductForm();
  assert.equal(parseProductUpdate(valid).error, undefined);
  const invalidCategory = validProductForm(); invalidCategory.set("category", "Other");
  assert.match(parseProductUpdate(invalidCategory).error, /category/);
  const unsafeImage = validProductForm(); unsafeImage.set("imagePath", "javascript:alert(1)");
  assert.match(parseProductUpdate(unsafeImage).error, /Image path/);
  const emptyName = validProductForm(); emptyName.set("name", "");
  assert.match(parseProductUpdate(emptyName).error, /name/);
});

test("analytics counts only verified paid orders and subtracts refunds without floating point", () => {
  const result = calculateVerifiedRevenue([
    { payment_status: "paid", grand_total_paise: 10_001, refunded_paise: 1_001 },
    { payment_status: "refunded", grand_total_paise: 20_000, refunded_paise: 20_000 },
    { payment_status: "failed", grand_total_paise: 99_999, refunded_paise: 0 },
    { payment_status: "pending", grand_total_paise: 99_999, refunded_paise: 0 },
  ]);
  assert.deepEqual(result, { grossPaise: 30_001, refundedPaise: 21_001, netPaise: 9_000, paidOrderCount: 2, averageOrderValuePaise: 15_000 });
});

test("Sprint 3 routes and additive migration are present", () => {
  for (const path of [
    "app/admin/page.tsx",
    "app/admin/orders/page.tsx",
    "app/admin/orders/[orderNumber]/page.tsx",
    "app/admin/products/page.tsx",
    "app/admin/products/[productId]/page.tsx",
    "app/admin/inventory/page.tsx",
    "app/admin/settings/page.tsx",
    "app/admin/analytics/page.tsx",
    "app/admin/audit-logs/page.tsx",
    "app/api/health/route.ts",
  ]) assert.equal(existsSync(path), true, path);

  const migration = readFileSync("supabase/migrations/20260710230000_sprint_3_operations.sql", "utf8");
  for (const table of ["audit_logs", "inventory_adjustments", "inventory_payment_applications"]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(migration, /product_variants_inventory_check/);
  assert.match(migration, /Stock cannot become negative/);
  assert.match(migration, /inventory_payment_applications where order_id = p_order_id/);
  assert.match(migration, /Invalid fulfilment transition/);
  assert.match(migration, /reject_append_only_change/);
  assert.match(migration, /drop policy if exists products_admin_delete/);
  assert.match(migration, /drop policy if exists orders_admin_update/);
  assert.match(migration, /revoke insert, update, delete on public\.products, public\.product_variants, public\.store_settings from authenticated/);
  assert.match(migration, /revoke update on public\.orders from authenticated/);
  assert.match(migration, /grant execute on function public\.admin_adjust_inventory[\s\S]+to service_role/);
  assert.match(migration, /revoke all on function public\.write_audit_log[\s\S]+from public, anon, authenticated/);
});

test("admin and customer data surfaces retain server-side privacy boundaries", () => {
  const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
  const actions = readFileSync("app/admin/actions.ts", "utf8");
  const tracking = readFileSync("app/api/orders/track/route.ts", "utf8");
  const webhook = readFileSync("app/api/payments/webhook/route.ts", "utf8");
  assert.match(adminLayout, /getAdminUser/);
  assert.match(adminLayout, /robots: \{ index: false/);
  assert.match(actions, /getAdminUser/);
  assert.doesNotMatch(tracking, /address_snapshot/);
  assert.doesNotMatch(webhook, /p_payload: body/);
  assert.match(webhook, /signatureVerified: true/);
});
