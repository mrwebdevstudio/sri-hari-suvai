export type AddressInput = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
};

export type CheckoutCartItemInput = {
  expectedUnitPricePaise?: number;
  productSlug: string;
  weightGrams: number;
  quantity: number;
};

export type CheckoutInput = AddressInput & {
  email: string;
  note: string | null;
  idempotencyKey: string;
  items: CheckoutCartItemInput[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const postalCodePattern = /^[A-Za-z0-9][A-Za-z0-9 -]{2,9}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function normalizePhone(value: unknown): string {
  return text(value, 30).replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}

export function isValidPostalCode(postalCode: string): boolean {
  return postalCodePattern.test(postalCode);
}

export function parseAddressInput(value: unknown): { data?: AddressInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Address details are required." };
  const source = value as Record<string, unknown>;
  const data: AddressInput = {
    name: text(source.name, 100),
    phone: normalizePhone(source.phone),
    addressLine1: text(source.addressLine1, 200),
    addressLine2: text(source.addressLine2, 200) || null,
    city: text(source.city, 100),
    state: text(source.state, 100),
    postalCode: text(source.postalCode, 10).toUpperCase(),
  };

  if (!data.name || !data.addressLine1 || !data.city || !data.state || !data.postalCode) {
    return { error: "Complete all required address fields." };
  }
  if (!isValidPhone(data.phone)) return { error: "Enter a valid phone number." };
  if (!isValidPostalCode(data.postalCode)) return { error: "Enter a valid postal code." };
  return { data };
}

export function parseCheckoutInput(value: unknown): { data?: CheckoutInput; error?: string } {
  const parsedAddress = parseAddressInput(value);
  if (!parsedAddress.data) return { error: parsedAddress.error };
  const source = value as Record<string, unknown>;
  const email = text(source.email, 254).toLowerCase();
  const note = text(source.note, 500) || null;
  const idempotencyKey = text(source.idempotencyKey, 36);
  if (!emailPattern.test(email)) return { error: "Enter a valid email address." };
  if (!uuidPattern.test(idempotencyKey)) return { error: "Invalid checkout request." };
  if (!Array.isArray(source.items) || source.items.length === 0 || source.items.length > 64) {
    return { error: "Your cart is empty or invalid." };
  }

  const items: CheckoutCartItemInput[] = [];
  for (const rawItem of source.items) {
    if (!rawItem || typeof rawItem !== "object") return { error: "Your cart contains an invalid item." };
    const item = rawItem as Record<string, unknown>;
    const productSlug = text(item.productSlug, 100);
    const weightGrams = Number(item.weightGrams);
    const quantity = Number(item.quantity);
    if (!/^[a-z0-9-]+$/.test(productSlug) || !Number.isInteger(weightGrams) || weightGrams <= 0) {
      return { error: "Your cart contains an invalid product variant." };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { error: "Cart quantities must be between 1 and 99." };
    }
    if (item.expectedUnitPricePaise !== undefined && (!Number.isSafeInteger(item.expectedUnitPricePaise) || Number(item.expectedUnitPricePaise) < 0)) return { error: "Invalid item price." };
    items.push({ productSlug, weightGrams, quantity, ...(item.expectedUnitPricePaise !== undefined && { expectedUnitPricePaise: Number(item.expectedUnitPricePaise) }) });
  }

  return { data: { ...parsedAddress.data, email, note, idempotencyKey, items } };
}

export function addressInputFromFormData(formData: FormData) {
  return parseAddressInput({
    name: formData.get("name"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
  });
}
