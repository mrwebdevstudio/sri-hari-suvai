export function sanitizeWhatsAppNumber(value: string): string {
  return value.replace(/\D/g, "");
}

type WhatsAppMessageOptions = {
  productName?: string;
  packSize?: string;
  quantity?: number;
  productUrl?: string;
};

export function buildWhatsAppHref(
  number: string,
  options: WhatsAppMessageOptions = {},
): string | null {
  const sanitizedNumber = sanitizeWhatsAppNumber(number);
  if (!sanitizedNumber) return null;

  const lines = ["Hello Sri Hari Suvai, I would like to make an enquiry."];
  if (options.productName?.trim()) {
    lines.push("Product: " + options.productName.trim());
  }
  if (options.packSize?.trim()) {
    lines.push("Pack size: " + options.packSize.trim());
  }
  if (options.quantity && Number.isInteger(options.quantity) && options.quantity > 0) {
    lines.push("Quantity: " + options.quantity);
  }
  if (options.productUrl?.trim()) {
    lines.push("Page: " + options.productUrl.trim());
  }

  return "https://wa.me/" + sanitizedNumber + "?text=" + encodeURIComponent(lines.join("\n"));
}

export function buildMailtoHref(email: string, subject: string): string | null {
  const normalized = email.trim();
  if (!normalized || !normalized.includes("@")) return null;
  return "mailto:" + normalized + "?subject=" + encodeURIComponent(subject);
}
