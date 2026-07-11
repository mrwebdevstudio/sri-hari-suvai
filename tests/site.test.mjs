import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { buildHeroImageMap, resolveHeroPng } from "../lib/assets.ts";
import {
  buildMailtoHref,
  buildWhatsAppHref,
  sanitizeWhatsAppNumber,
} from "../lib/ordering.ts";
import { getProductBySlug, products } from "../lib/products.ts";

test("every known product slug resolves to its catalogue entry", () => {
  for (const product of products) {
    assert.equal(getProductBySlug(product.slug), product);
  }
  assert.equal(getProductBySlug("unknown-product"), undefined);
});

test("catalogue contains exactly 16 products, 64 paise-priced variants, and the approved category split", () => {
  assert.equal(products.length, 16);
  assert.equal(products.filter((product) => product.category === "Instant Mix").length, 10);
  assert.equal(products.filter((product) => product.category === "Direct Mix").length, 6);
  assert.equal(products.flatMap((product) => product.variants).length, 64);

  for (const product of products) {
    assert.deepEqual(product.variants.map((variant) => variant.weightGrams), [100, 250, 500, 1000]);
    assert.ok(product.variants.every((variant) => Number.isInteger(variant.pricePaise)));
  }
});

test("catalogue prices match the supplied price list exactly", () => {
  const expectedRupees = {
    "sambar-podi": [100, 200, 400, 800],
    "rasam-podi": [100, 200, 400, 800],
    "vathakkuzhambu-podi": [90, 175, 350, 700],
    "vendhya-kuzhambu-podi": [90, 175, 350, 700],
    "morkuzhambu-podi": [90, 175, 350, 700],
    "poriyal-podi": [100, 200, 400, 800],
    "koottu-podi": [100, 200, 400, 800],
    "kuruma-podi": [125, 225, 450, 900],
    "bisibelabath-podi": [125, 225, 450, 900],
    "arisi-upma-mix": [35, 70, 140, 280],
    "puliyodharai-podi": [90, 175, 350, 700],
    "paruppu-podi": [65, 125, 250, 500],
    "dhaniya-podi": [65, 125, 250, 500],
    "idly-podi": [75, 150, 300, 600],
    "thenga-podi": [100, 200, 400, 800],
    "vellai-ellu-podi": [100, 200, 400, 800],
  };

  for (const product of products) {
    assert.deepEqual(
      product.variants.map((variant) => variant.pricePaise),
      expectedRupees[product.slug].map((price) => price * 100),
      product.name,
    );
  }
});

test("product hero resolver rejects unsafe paths and maps known entries", () => {
  assert.equal(resolveHeroPng("../secret"), null);
  assert.deepEqual(buildHeroImageMap([]), {});
  for (const product of products) {
    assert.equal(resolveHeroPng(product.slug), `/images/products/${product.slug}.png`);
  }
});

test("Sprint 1 shop and cart routes exist", () => {
  assert.equal(existsSync("app/shop/page.tsx"), true);
  assert.equal(existsSync("app/cart/page.tsx"), true);
});

test("required generated hero assets exist", () => {
  assert.equal(existsSync("public/images/generated/home-hero-desktop.webp"), true);
  assert.equal(existsSync("public/images/generated/home-hero-mobile.webp"), true);
});

test("reduced-motion styles disable nonessential motion and keep reveals visible", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const motionSystem = readFileSync("components/motion/MotionSystem.tsx", "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.image-placeholder--animated span\s*{\s*animation: none;/);
  assert.match(css, /\[data-motion-ready="true"\]\s*{[\s\S]*?opacity: 1 !important;/);
  assert.match(motionSystem, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(motionSystem, /IntersectionObserver/);
});

test("WhatsApp enquiries sanitize the number and encode verified details", () => {
  assert.equal(sanitizeWhatsAppNumber("+91 98765-43210"), "919876543210");
  const href = buildWhatsAppHref("+91 98765-43210", {
    productName: "Sample product",
    packSize: "250 g",
    quantity: 2,
    productUrl: "https://example.test/products/sample-product",
  });
  assert.ok(href?.startsWith("https://wa.me/919876543210?text="));
  const message = decodeURIComponent(href.split("?text=")[1]);
  assert.match(message, /Product: Sample product/);
  assert.match(message, /Pack size: 250 g/);
  assert.match(message, /Quantity: 2/);
  assert.match(message, /Page: https:\/\/example.test\/products\/sample-product/);
  assert.equal(buildWhatsAppHref(""), null);
});

test("email fallback is only built for a plausible configured address", () => {
  assert.equal(buildMailtoHref("", "Enquiry"), null);
  assert.equal(buildMailtoHref("invalid", "Enquiry"), null);
  assert.equal(
    buildMailtoHref("hello@example.test", "Product enquiry"),
    "mailto:hello@example.test?subject=Product%20enquiry",
  );
});
