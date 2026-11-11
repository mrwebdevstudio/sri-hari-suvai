export type PricingRules = {
  flatShippingPaise: number | null;
  freeShippingThresholdPaise: number | null;
  taxMode: string | null;
  taxRateBps: number | null;
  taxShipping: boolean | null;
  discountMode: string | null;
};

const maxPaise = 2_147_483_647;
function validPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxPaise;
}

export function calculateShippingPaise(subtotal: number, flat: number | null, threshold: number | null) {
  if (!validPaise(subtotal) || !validPaise(flat) || (threshold !== null && !validPaise(threshold))) return null;
  return threshold !== null && subtotal > threshold ? 0 : flat;
}

export function calculateCheckoutQuote(subtotalPaise: number, rules: PricingRules) {
  const shippingPaise = calculateShippingPaise(subtotalPaise, rules.flatShippingPaise, rules.freeShippingThresholdPaise);
  if (shippingPaise === null || rules.discountMode !== "none") return null;
  let taxPaise = 0;
  if (rules.taxMode === "exclusive_order_half_up") {
    const rate = rules.taxRateBps;
    if (!validPaise(rate) || rate > 10000 || typeof rules.taxShipping !== "boolean") return null;
    const taxable = subtotalPaise + (rules.taxShipping ? shippingPaise : 0);
    taxPaise = Math.floor((taxable * rate + 5000) / 10000);
  } else if (rules.taxMode !== "none" || rules.taxRateBps !== null || rules.taxShipping !== null) {
    return null;
  }
  const grandTotalPaise = subtotalPaise + shippingPaise + taxPaise;
  if (!validPaise(grandTotalPaise)) return null;
  return { subtotalPaise, shippingPaise, taxPaise, discountPaise: 0, grandTotalPaise };
}

export function acceptsQuote(expected: unknown, quote: NonNullable<ReturnType<typeof calculateCheckoutQuote>>) {
  if (!expected || typeof expected !== "object") return false;
  const supplied = expected as Record<string, unknown>;
  return Object.entries(quote).every(([key, value]) => supplied[key] === value);
}

export function servesPostalCode(mode: string | null, codes: string[] | null, pin: string) {
  return /^[1-9]\d{5}$/.test(pin) && mode === "pan_india_serviceable" && !!codes?.includes(pin);
}
