import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import pg from "pg";

// Opt in with a loopback-only PostgreSQL test cluster. Each run owns a fresh database.
const configFile = process.env.SHS_LOCAL_PG_CONFIG;
test("two PostgreSQL sessions serialize last-pack checkout, retries, release and capture", {
  skip: configFile ? false : "Requires a disposable loopback PostgreSQL cluster",
}, async () => {
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  assert.ok(["127.0.0.1", "::1"].includes(config.host));
  const dbName = "shs_sprint5_" + randomUUID().replaceAll("-", "");
  const control = new pg.Client(config);
  const first = new pg.Client({...config, database:dbName});
  const second = new pg.Client({...config, database:dbName});
  await control.connect();
  await control.query("create database " + dbName);
  try {
    await Promise.all([first.connect(),second.connect()]);
    const bootstrap = readFileSync("tests/fixtures/supabase-bootstrap.sql","utf8");
    for (const role of ["anon","authenticated","service_role"]) {
      if (!(await control.query("select 1 from pg_roles where rolname=$1",[role])).rowCount) {
        await control.query("create role " + role);
      }
    }
    await first.query(bootstrap.replace(/create role (anon|authenticated|service_role);/g, ""));
    for (const name of readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort()) {
      await first.query(readFileSync("supabase/migrations/"+name,"utf8").replace("create extension if not exists pgcrypto;",""));
    }
    await first.query(readFileSync("tests/fixtures/single-store-admin.sql","utf8"));
    await first.query("select set_config('request.jwt.claim.sub',current_setting('shs_test.ephemeral_owner'),false)");
    await first.query("update public.store_settings set flat_shipping_paise=0,tax_mode='none',serviceable_postal_codes=array['600001'],policies_approved=true,checkout_enabled=true");
    const {rows:[pack]}=await first.query("select id,product_id,price_paise from public.product_variants limit 1");
    const {rows:[variant]}=await first.query("update public.product_variants set track_inventory=true,stock_quantity=1 where id=$1 returning weight_grams",[pack.id]);
    const lines=JSON.stringify([{product_id:pack.product_id,product_variant_id:pack.id,weight_grams:variant.weight_grams,unit_price_paise:pack.price_paise,quantity:1}]);
    const order=(client,number,key)=>client.query("select public.create_pending_order($1,null,'qa@example.invalid','9000000000','QA',$2,null,$3,0,$4,$5) id",
      [number,{postalCode:"600001"},pack.price_paise,key,lines]);
    const {rows:[{pid}]}=await second.query("select pg_backend_pid() pid");
    async function blocked() {
      for(let i=0;i<60;i++){
        if((await control.query("select 1 from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[pid])).rowCount)return;
        await pause(25);
      }
      assert.fail("Second backend never waited on the database lock");
    }
    await first.query("begin");
    const key=randomUUID();
    const {rows:[{id}]}=await order(first,"SHS-20261111-CSHA23",key);
    const contested=assert.rejects(order(second,"SHS-20261111-CSHB23",randomUUID()),{code:"SH002"});
    await blocked(); await first.query("commit"); await contested;
    await assert.rejects(order(second,"SHS-20261111-CSHC23",key),{code:"23505"});
    assert.equal((await first.query("select count(*)::int n from public.orders")).rows[0].n,1);
    assert.equal((await first.query("select reserved_quantity from public.product_variants where id=$1",[pack.id])).rows[0].reserved_quantity,1);

    await first.query("begin");
    await first.query("select public.release_order_reservations($1,'QA manual release')",[id]);
    const capture=second.query("select public.apply_payment_event($1,'qa-late','payment.captured','paid','pay_qa',$2)",[id,
      {signatureVerified:true,captureStatus:"captured",amount:pack.price_paise,currency:"INR"}]);
    await blocked(); await first.query("commit"); await capture;
    assert.deepEqual((await first.query("select payment_status,inventory_review_required from public.orders where id=$1",[id])).rows[0],
      {payment_status:"paid",inventory_review_required:true});
    await first.query("select public.reconcile_captured_inventory($1,'QA allocated available stock')",[id]);
    assert.deepEqual((await first.query("select stock_quantity,reserved_quantity from public.product_variants where id=$1",[pack.id])).rows[0],
      {stock_quantity:0,reserved_quantity:0});
  } finally {
    await Promise.allSettled([first.end(),second.end()]);
    try { await control.query("drop database "+dbName); } finally { await control.end(); }
  }
});
