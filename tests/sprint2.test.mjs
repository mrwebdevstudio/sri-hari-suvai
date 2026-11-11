import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateShippingPaise,
  createHmacSignature,
  generateOrderNumber,
  verifyHmacSignature,
} from "../lib/orders.ts";
import { normalizePhone, parseCheckoutInput } from "../lib/validation.ts";

test("order numbers use the required dated six-character format", () => {
  const value = generateOrderNumber(new Date("2026-07-10T12:00:00.000Z"), Buffer.from([0, 1, 2, 3, 4, 5]));
  assert.equal(value, "SHS-20260710-ABCDEF");
  assert.match(value, /^SHS-\d{8}-[A-Z2-9]{6}$/);
});

test("shipping uses configured integer paise and honors the free threshold", () => {
  assert.equal(calculateShippingPaise(49_999, 5_000, 50_000), 5_000);
  assert.equal(calculateShippingPaise(50_000, 5_000, 50_000), 5_000);
  assert.equal(calculateShippingPaise(50_001, 5_000, 50_000), 0);
  assert.equal(calculateShippingPaise(10_000, null, 50_000), null);
  assert.equal(calculateShippingPaise(10_000.5, 5_000, null), null);
});

test("payment signatures require an exact timing-safe HMAC match", () => {
  const signature = createHmacSignature("order_1|pay_1", "secret");
  assert.equal(verifyHmacSignature("order_1|pay_1", signature, "secret"), true);
  assert.equal(verifyHmacSignature("order_1|pay_2", signature, "secret"), false);
  assert.equal(verifyHmacSignature("order_1|pay_1", signature, "wrong"), false);
});

test("checkout validation normalizes contact data and rejects cart tampering", () => {
  const valid = {
    name: "Customer",
    phone: "+91 98765 43210",
    email: "CUSTOMER@example.com",
    addressLine1: "1 Market Road",
    addressLine2: "",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "600001",
    note: "Leave at reception",
    idempotencyKey: "90f48a44-e002-4a65-9a30-b482145efb46",
    items: [{ productSlug: "sambar-podi", weightGrams: 250, quantity: 2 }],
  };
  const parsed = parseCheckoutInput(valid);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.data?.phone, "919876543210");
  assert.equal(parsed.data?.email, "customer@example.com");
  assert.equal(normalizePhone("+91-98765-43210"), "919876543210");
  assert.match(parseCheckoutInput({ ...valid, items: [{ ...valid.items[0], quantity: 0 }] }).error, /quantities/);
  assert.match(parseCheckoutInput({ ...valid, idempotencyKey: "predictable" }).error, /Invalid checkout/);
  assert.match(parseCheckoutInput({ ...valid, postalCode: "?" }).error, /postal code/);
});

test("Sprint 2 routes and the Supabase migration are present", () => {
  for (const path of [
    "app/checkout/page.tsx",
    "app/login/page.tsx",
    "app/signup/page.tsx",
    "app/account/orders/page.tsx",
    "app/track-order/page.tsx",
    "app/api/checkout/route.ts",
    "app/api/payments/verify/route.ts",
    "app/api/payments/webhook/route.ts",
  ]) assert.equal(existsSync(path), true, path);

  const migration = readFileSync("supabase/migrations/20260710170000_sprint_2_commerce.sql", "utf8");
  for (const table of ["profiles", "addresses", "products", "product_variants", "orders", "order_items", "order_status_history", "payment_events", "store_settings"]) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(migration, /price_paise integer not null/);
  assert.match(migration, /grant execute on function public\.apply_payment_event[\s\S]+to service_role;/);
  assert.match(migration, /revoke all on function public\.apply_payment_event[\s\S]+from public, anon, authenticated;/);
  assert.match(migration, /profiles_update_own_or_admin/);
  assert.match(migration, /grant update \(full_name, phone, updated_at\) on public\.profiles/);
});
