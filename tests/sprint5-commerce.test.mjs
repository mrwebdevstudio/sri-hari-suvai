import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { acceptsQuote, calculateCheckoutQuote, servesPostalCode } from "../lib/checkout-pricing.ts";
import { formatPrice } from "../lib/currency.ts";
import { checkoutMatchesOrder } from "../lib/checkout-retry.ts";
import { readRazorpayEvent } from "../lib/razorpay-events.ts";
import { createRazorpayOrder, fetchRazorpayPayment } from "../lib/razorpay.ts";

const rules = { flatShippingPaise: 801, freeShippingThresholdPaise: 200000,
  taxMode: "none", taxRateBps: null, taxShipping: null, discountMode: "none" };

test("approved free shipping is strictly above ₹2,000 and never discounts merchandise", () => {
  for (const [subtotal, shipping] of [[199999, 801], [200000, 801], [200001, 0]]) {
    assert.deepEqual(calculateCheckoutQuote(subtotal, rules), {
      subtotalPaise: subtotal, shippingPaise: shipping, taxPaise: 0, discountPaise: 0, grandTotalPaise: subtotal + shipping,
    });
  }
  assert.equal(formatPrice(200001).replaceAll(",", ""), "₹2000.01");
  for (const overrides of [{flatShippingPaise:null}, {taxMode:null}, {discountMode:null}, {taxRateBps:2},
    {freeShippingThresholdPaise:-1}, {flatShippingPaise:1.1}]) {
    assert.equal(calculateCheckoutQuote(200001,{...rules,...overrides}),null);
  }
  assert.equal(calculateCheckoutQuote(2147483647,{...rules,freeShippingThresholdPaise:null}),null);
});

test("Indian delivery needs a confirmed PIN, including above the free-shipping threshold", () => {
  const mode = "pan_india_serviceable";
  assert.equal(servesPostalCode(mode,["600001"],"600001"),true);
  for (const [coverage,codes,pin] of [[mode,null,"600001"],[mode,[],"600001"],[mode,["600001"],"600002"],
    [mode,["000000"],"000000"],[null,["600001"],"600001"]]) assert.equal(servesPostalCode(coverage,codes,pin),false);
});

test("explicit synthetic tax rules use integer half-up rounding on the selected base", () => {
  const taxable = {...rules,taxMode:"exclusive_order_half_up",taxRateBps:100,taxShipping:false};
  assert.equal(calculateCheckoutQuote(49,taxable).taxPaise,0);
  assert.equal(calculateCheckoutQuote(50,taxable).taxPaise,1);
  const quote = calculateCheckoutQuote(50,{...taxable,taxShipping:true});
  assert.deepEqual(quote,{subtotalPaise:50,shippingPaise:801,taxPaise:9,discountPaise:0,grandTotalPaise:860});
  assert.equal(acceptsQuote(quote,quote),true);
  for (const key of Object.keys(quote)) assert.equal(acceptsQuote({...quote,[key]:quote[key]+1},quote),false);
  assert.equal(acceptsQuote(null,quote),false);
  const order={user_id:null,email:"fixture",phone:"fixture",customer_name:"fixture",customer_note:null,address_snapshot:{},
    subtotal_paise:50,shipping_paise:801,tax_paise:9,discount_paise:0,grand_total_paise:860,order_items:[]};
  const input={email:"fixture",phone:"fixture",name:"fixture",note:null};
  order.address_snapshot={name:input.name,phone:input.phone};
  assert.equal(checkoutMatchesOrder(order,input,null,[],50,801,9,0),true);
  assert.equal(checkoutMatchesOrder(order,input,null,[],50,801,10,1),false);
});

test("webhooks require event-specific capture, amount, currency and matching identifiers", () => {
  const payment={id:"pay_fixture",order_id:"order_fixture",status:"captured",currency:"INR",amount:100};
  const event=(p)=>({event:"payment.captured",payload:{payment:{entity:p}}});
  assert.equal(readRazorpayEvent(event(payment)).kind,"recognized");
  for(const patch of [{status:"authorized"},{currency:"USD"},{currency:undefined},{amount:"100"},{amount:0},{order_id:null}]) {
    assert.equal(readRazorpayEvent(event({...payment,...patch})).kind,"invalid");
  }
  const refund={id:"rfnd_fixture",payment_id:payment.id,amount:25,currency:"INR",status:"processed"};
  const refunded=(r)=>({event:"refund.processed",payload:{refund:{entity:r},payment:{entity:payment}}});
  assert.equal(readRazorpayEvent(refunded(refund)).eventAmount,25);
  assert.equal(readRazorpayEvent(refunded({...refund,currency:"USD"})).kind,"invalid");
  assert.equal(readRazorpayEvent(refunded({...refund,payment_id:"other"})).kind,"invalid");
  assert.equal(readRazorpayEvent(null).kind,"invalid");
});

test("provider adapter recovers an interrupted order by its unique receipt without another POST",async(t)=>{
  const previous={};
  for(const variable of ["RAZORPAY_KEY_ID","RAZORPAY_KEY_SECRET","COMMERCE_ENVIRONMENT"]) previous[variable]=process.env[variable];
  // Ephemeral credentials for the in-process HTTP mock only.
  process.env.RAZORPAY_KEY_ID="rzp_test_"+randomBytes(8).toString("hex");
  process.env.RAZORPAY_KEY_SECRET=randomBytes(24).toString("hex");
  process.env.COMMERCE_ENVIRONMENT="development";
  t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  const input={amountPaise:500,orderNumber:"SHS-20261111-ABC234",customerEmail:"fixture@example.invalid",customerPhone:"9000000000"};
  let saved,posts=0,lookupStatus=200;
  t.mock.method(globalThis,"fetch",async(url,options)=>{
    assert.ok(options.signal instanceof AbortSignal);
    if(options.method==="POST"){
      posts++; saved={...JSON.parse(options.body),id:"order_fixture"};
      throw new DOMException("Fixture timeout","TimeoutError");
    }
    if(String(url).includes("/payments/"))return new Response(null,{status:503});
    assert.equal(new URL(url).searchParams.get("receipt"),input.orderNumber);
    return Response.json({items:saved?[saved]:[]},{status:lookupStatus});
  });
  await assert.rejects(createRazorpayOrder(input),{name:"TimeoutError"});
  assert.equal((await createRazorpayOrder(input)).id,saved.id);
  saved.currency="USD"; await assert.rejects(createRazorpayOrder(input),/invalid order/);
  saved.currency="INR"; saved.amount++; await assert.rejects(createRazorpayOrder(input),/invalid order/);
  lookupStatus=503; await assert.rejects(createRazorpayOrder(input),/receipt lookup failed/);
  await assert.rejects(fetchRazorpayPayment("pay_fixture"),/payment lookup failed/);
  assert.equal(posts,1);
});
