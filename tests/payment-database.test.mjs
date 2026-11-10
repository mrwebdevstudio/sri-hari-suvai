import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("payment SQL preserves refunds, deduplicates notifications and applies inventory once", async () => {
  const db = await PGlite.create();
  try {
    // Minimal Supabase identity fixtures. This test exercises PostgreSQL functions,
    // not hosted Auth, API configuration, or multi-session concurrency.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}',
        raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz, deleted_at timestamptz, encrypted_password text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text);
      alter table storage.objects enable row level security;
    `);
    for (const name of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
      // gen_random_uuid is built into PostgreSQL; PGlite does not need pgcrypto.
      const sql = readFileSync(`supabase/migrations/${name}`, "utf8").replace("create extension if not exists pgcrypto;", "");
      await db.exec(sql);
    }
    const { rows: [variant] } = await db.query("select v.id, v.product_id, p.slug from public.product_variants v join public.products p on p.id=v.product_id where p.slug='sambar-podi' and v.weight_grams=100");
    await db.query("update public.product_variants set track_inventory=true, stock_quantity=5 where id=$1", [variant.id]);
    const { rows: [order] } = await db.query(`insert into public.orders
      (order_number,email,phone,customer_name,address_snapshot,subtotal_paise,shipping_paise,grand_total_paise,idempotency_key)
      values ('SHS-20260929-ABC234','buyer@example.test','9000000000','Test','{}',10000,0,10000,gen_random_uuid()) returning id`);
    await db.query(`insert into public.order_items
      (order_id,product_id,product_variant_id,product_name,product_slug,variant_name,weight_grams,unit_price_paise,quantity,line_total_paise)
      values ($1,$2,$3,'Test',$4,'100 g',100,10000,1,10000)`, [order.id,variant.product_id,variant.id,variant.slug]);
    assert.equal((await db.query("select reserved_quantity from public.product_variants where id=$1",[variant.id])).rows[0].reserved_quantity,1);
    const apply = async (event, status, payload = {}, payment = "pay_test") => {
      const result = await db.query("select public.apply_payment_event($1,$2,$3,$4,$5,$6::jsonb) as applied",
        [order.id, event, `test.${status}`, status, payment, JSON.stringify({ amount: 10000, currency: "INR", signatureVerified: true, ...payload })]);
      return result.rows[0].applied;
    };
    const state = async () => (await db.query("select payment_status,refunded_paise from public.orders where id=$1", [order.id])).rows[0];

    await assert.rejects(apply("unsigned", "paid", { signatureVerified: false }), /Unverified/);
    await assert.rejects(apply("currency", "paid", { currency: null }), /Unverified/);
    await assert.rejects(apply("amount", "paid", { amount: 9999 }), /amount/);
    assert.equal(await apply("capture", "paid"), true);
    assert.equal(await apply("capture", "paid"), false);
    assert.equal(await apply("second-channel-capture", "paid"), false);
    await assert.rejects(apply("different-payment", "paid", {}, "pay_other"), /does not match/);
    assert.equal(await apply("late-failure", "failed"), false);
    assert.equal((await state()).payment_status, "paid");

    assert.equal(await apply("partial-refund", "refunded", { amount: 3000, refundId: "rf_one" }), true);
    assert.equal(await apply("refund-repeated-with-new-event", "refunded", { amount: 3000, refundId: "rf_one" }), false);
    assert.deepEqual(await state(), { payment_status: "paid", refunded_paise: 3000 });
    assert.equal(await apply("capture-after-partial", "paid"), false);
    await assert.rejects(apply("too-much", "refunded", { amount: 8000, refundId: "rf_excess" }), /exceeds/);
    await assert.rejects(apply("missing-refund-id", "refunded", { amount: 1000 }), /identity/);
    assert.equal(await apply("final-refund", "refunded", { amount: 7000, refundId: "rf_two" }), true);
    assert.equal(await apply("capture-after-refund", "paid"), false);
    assert.equal(await apply("failure-after-refund", "failed"), false);
    assert.deepEqual(await state(), { payment_status: "refunded", refunded_paise: 10000 });
    assert.equal((await db.query("select stock_quantity from public.product_variants where id=$1", [variant.id])).rows[0].stock_quantity, 4);
    assert.equal((await db.query("select reserved_quantity from public.product_variants where id=$1", [variant.id])).rows[0].reserved_quantity,0);
    assert.equal(Number((await db.query("select count(*) from public.inventory_adjustments where order_id=$1", [order.id])).rows[0].count), 1);
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, 'public.apply_payment_event(uuid,text,text,text,text,jsonb)', 'EXECUTE') as allowed", [role])).rows[0].allowed, false);
    }
    await db.exec(readFileSync("tests/fixtures/single-store-admin.sql","utf8"));
    await db.exec(readFileSync("supabase/validation/dev_backend_acceptance.sql","utf8"));
  } finally { await db.close(); }
});
