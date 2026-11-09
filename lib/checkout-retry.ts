import type { CheckoutInput } from "./validation";

export type OrderItemSnapshot = {
  product_slug: string;
  weight_grams: number;
  quantity: number;
  unit_price_paise: number;
};

export type RetryOrder = {
  user_id: string | null;
  email: string;
  phone: string;
  customer_name: string;
  customer_note: string | null;
  address_snapshot: Record<string, unknown>;
  subtotal_paise: number;
  shipping_paise: number;
  grand_total_paise: number;
  order_items: OrderItemSnapshot[];
};

function sortedItems(items: readonly OrderItemSnapshot[]): string {
  return JSON.stringify(items.map((item) => [item.product_slug, item.weight_grams, item.quantity, item.unit_price_paise])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export function checkoutMatchesOrder(order: RetryOrder, input: CheckoutInput, userId: string | null,
  items: readonly OrderItemSnapshot[], subtotalPaise: number, shippingPaise: number): boolean {
  const addressKeys = ["name", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode"] as const;
  return order.user_id === userId && order.email === input.email && order.phone === input.phone &&
    order.customer_name === input.name && (order.customer_note || null) === input.note &&
    order.subtotal_paise === subtotalPaise && order.shipping_paise === shippingPaise &&
    order.grand_total_paise === subtotalPaise + shippingPaise &&
    addressKeys.every((key) => (order.address_snapshot?.[key] || null) === (input[key] || null)) &&
    sortedItems(order.order_items) === sortedItems(items);
}
