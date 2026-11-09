import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";

import { products } from "../lib/products.ts";

const sprint2MigrationPath = "supabase/migrations/20260710170000_sprint_2_commerce.sql";
const sprint3MigrationPath = "supabase/migrations/20260710230000_sprint_3_operations.sql";
const sprint4MigrationPath = "supabase/migrations/20260805090000_sprint_4_validation_hardening.sql";
const sprint2Migration = readFileSync(sprint2MigrationPath, "utf8");
const sprint3Migration = readFileSync(sprint3MigrationPath, "utf8");
const sprint4Migration = readFileSync(sprint4MigrationPath, "utf8");

function sourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

test("the environment contract is complete and keeps privileged values server-only", () => {
  const required = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_WHATSAPP_NUMBER",
    "NEXT_PUBLIC_BUSINESS_EMAIL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "EMAIL_WEBHOOK_URL",
    "EMAIL_WEBHOOK_SECRET",
    "APP_VERSION",
  ];
  const declared = readFileSync(".env.example", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("=", 1)[0]);
  assert.deepEqual(declared, required);

  const forbiddenClientValues = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "EMAIL_WEBHOOK_SECRET",
    "createAdminSupabaseClient",
  ];
  for (const path of [...sourceFiles("app"), ...sourceFiles("components")]) {
    const source = readFileSync(path, "utf8");
    if (!/^\s*["']use client["'];/m.test(source)) continue;
    for (const value of forbiddenClientValues) {
      assert.doesNotMatch(source, new RegExp(value), `${value} must not be referenced by ${path}`);
    }
  }
});

test("commerce migrations retain the required chronological order", () => {
  const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
  assert.deepEqual(migrations, [
    "20260710170000_sprint_2_commerce.sql",
    "20260710230000_sprint_3_operations.sql",
    "20260805090000_sprint_4_validation_hardening.sql",
    "20260929100200_sprint_1_payment_event_safety.sql",
  ]);
});

test("Sprint 4 corrects the demonstrated audit entity-type constraint defect additively", () => {
  assert.match(sprint3Migration, /entity_type text not null check \(event_type <> '' and char_length\(entity_type\) <= 80\)/);
  assert.match(sprint4Migration, /drop constraint if exists audit_logs_entity_type_check/);
  assert.match(sprint4Migration, /check \(char_length\(entity_type\) between 1 and 80\)/);
  assert.doesNotMatch(sprint4Migration, /\b(update|delete|truncate)\b/i);
});

test("the database seed exactly matches all 16 source products and 64 integer-paise variants", () => {
  const variantsBlock = sprint2Migration.slice(sprint2Migration.indexOf("insert into public.product_variants"));
  const seeded = [...variantsBlock.matchAll(/\('([^']+)',\s*(\d+),\s*(\d+)\)/g)]
    .map((match) => ({ slug: match[1], weightGrams: Number(match[2]), pricePaise: Number(match[3]) }))
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.weightGrams - b.weightGrams);
  const expected = products
    .flatMap((product) => product.variants.map((variant) => ({ slug: product.slug, ...variant })))
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.weightGrams - b.weightGrams);

  assert.equal(products.length, 16);
  assert.equal(seeded.length, 64);
  assert.deepEqual(seeded, expected);
  assert.ok(seeded.every((variant) => Number.isInteger(variant.pricePaise) && variant.pricePaise > 0));
});

test("RLS, privilege boundaries, append-only history, and payment idempotency remain encoded in SQL", () => {
  const rlsTables = [
    "profiles",
    "addresses",
    "products",
    "product_variants",
    "orders",
    "order_items",
    "order_status_history",
    "payment_events",
    "store_settings",
  ];
  for (const table of rlsTables) {
    assert.match(sprint2Migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  for (const table of ["audit_logs", "inventory_adjustments", "inventory_payment_applications"]) {
    assert.match(sprint3Migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }

  assert.match(sprint2Migration, /grant update \(full_name, phone, updated_at\) on public\.profiles/);
  assert.doesNotMatch(sprint2Migration, /grant update \([^)]*role[^)]*\) on public\.profiles/);
  assert.match(sprint3Migration, /revoke insert, update, delete on public\.products, public\.product_variants, public\.store_settings from authenticated/);
  assert.match(sprint3Migration, /revoke update on public\.orders from authenticated/);
  assert.match(sprint3Migration, /audit_logs_append_only[\s\S]+before update or delete on public\.audit_logs/);
  assert.match(sprint3Migration, /inventory_adjustments_append_only[\s\S]+before update or delete on public\.inventory_adjustments/);
  assert.match(sprint3Migration, /inventory_payment_applications where order_id = p_order_id/);
  assert.match(sprint3Migration, /insert into public\.inventory_payment_applications \(order_id, provider_event_id\)/);
  assert.match(sprint3Migration, /on conflict \(provider_event_id\) do nothing/);
  assert.match(sprint3Migration, /event_amount <> current_order\.grand_total_paise/);

  for (const functionName of [
    "apply_payment_event",
    "create_pending_order",
    "claim_payment_initialization",
    "finish_payment_initialization",
    "write_audit_log",
    "admin_update_order_fulfillment",
    "admin_adjust_inventory",
    "admin_update_product",
    "admin_update_variant",
    "admin_update_store_settings",
  ]) {
    const combined = `${sprint2Migration}\n${sprint3Migration}`;
    assert.match(combined, new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]+?from public, anon, authenticated;`));
    assert.match(combined, new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]+?to service_role;`));
  }
});

test("the checked-in database validator is explicitly read-only", () => {
  const sql = readFileSync("supabase/validation/sprint_4_commerce_validation.sql", "utf8");
  assert.match(sql, /begin transaction read only;/i);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /^\s*(insert|update|delete|alter|drop|truncate|create)\b/im);
});
