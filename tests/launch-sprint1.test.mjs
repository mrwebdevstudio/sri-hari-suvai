import assert from "node:assert/strict";
import test from "node:test";
import { checkoutMatchesOrder } from "../lib/checkout-retry.ts";
import { createOrderReceipt, verifyOrderReceipt, paymentConfirmationCopy, ORDER_RECEIPT_SECONDS } from "../lib/order-receipt.ts";

const orderNumber = "SHS-20260929-ABC234";
const now = Date.UTC(2026, 8, 29);

test("guest receipt is scoped to one order, expires, and rejects forgery", () => {
  const receipt = createOrderReceipt(orderNumber, "test-only-secret", now);
  assert.equal(verifyOrderReceipt(receipt, orderNumber, "test-only-secret", now), true);
  assert.equal(verifyOrderReceipt(receipt, "SHS-20260929-DEF234", "test-only-secret", now), false);
  assert.equal(verifyOrderReceipt(receipt, orderNumber, "wrong-secret", now), false);
  assert.equal(verifyOrderReceipt(receipt, orderNumber, "", now), false);
  assert.equal(verifyOrderReceipt(receipt, orderNumber, "test-only-secret", now + ORDER_RECEIPT_SECONDS * 1000), false);
  assert.equal(verifyOrderReceipt(receipt + "x", orderNumber, "test-only-secret", now), false);
  const parts = receipt.split(".");
  parts[1] = String(Number(parts[1]) + 1);
  assert.equal(verifyOrderReceipt(parts.join("."), orderNumber, "test-only-secret", now), false);
  assert.throws(() => createOrderReceipt("not-an-order", "test-only-secret", now));
});

test("confirmation distinguishes verified paid, pending, failed, refunded and unknown states", () => {
  assert.equal(paymentConfirmationCopy("paid").title, "Payment confirmed");
  for (const status of [null, "pending", "failed", "refunded", "invalid"]) {
    assert.notEqual(paymentConfirmationCopy(status).title, "Payment confirmed");
  }
});

const input = {
  name: "Test Buyer", phone: "9000000000", email: "buyer@example.test", addressLine1: "Test address",
  addressLine2: null, city: "Test city", state: "Test state", postalCode: "600001", note: null,
  idempotencyKey: "a23e4567-e89b-42d3-a456-426614174000",
  items: [{ productSlug: "sambar-podi", weightGrams: 100, quantity: 1 }],
};
const items = [{ product_slug: "sambar-podi", weight_grams: 100, quantity: 1, unit_price_paise: 10000 }];
const order = {
  user_id: "customer-a", email: input.email, phone: input.phone, customer_name: input.name, customer_note: null,
  address_snapshot: { name: input.name, phone: input.phone, addressLine1: input.addressLine1, addressLine2: null,
    city: input.city, state: input.state, postalCode: input.postalCode },
  subtotal_paise: 10000, shipping_paise: 500, grand_total_paise: 10500, order_items: items,
};

test("identical checkout can retry but equal-priced swaps, address changes and ownership changes cannot", () => {
  const matches = (candidate = input, owner = "customer-a", snapshots = items, subtotal = 10000, shipping = 500) =>
    checkoutMatchesOrder(order, candidate, owner, snapshots, subtotal, shipping);
  assert.equal(matches(), true);
  for (const key of ["name", "phone", "email", "addressLine1", "addressLine2", "city", "state", "postalCode", "note"]) {
    assert.equal(matches({ ...input, [key]: "changed" }), false, key);
  }
  assert.equal(matches(input, "customer-b"), false);
  assert.equal(matches(input, null), false);
  assert.equal(matches(input, "customer-a", [{ ...items[0], product_slug: "rasam-podi" }]), false);
  assert.equal(matches(input, "customer-a", [{ ...items[0], quantity: 2 }]), false);
  assert.equal(matches(input, "customer-a", [{ ...items[0], weight_grams: 250 }]), false);
  assert.equal(matches(input, "customer-a", [{ ...items[0], unit_price_paise: 9500 }], 9500, 1000), false);
});

test("retry comparison is independent of item ordering", () => {
  const twoItems = [...items, { ...items[0], product_slug: "rasam-podi" }];
  assert.equal(checkoutMatchesOrder({ ...order, order_items: twoItems }, input, "customer-a", [...twoItems].reverse(), 10000, 500), true);
});
