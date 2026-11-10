import { getAdminUser } from "@/lib/auth";
import { noStoreJson } from "@/lib/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const NextResponse = { json: noStoreJson };

function optionalMoney(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
}

export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("store_settings").select("*").eq("settings_key", "default").single();
  return error ? NextResponse.json({ error: "Could not load store settings." }, { status: 500 }) : NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const flat = optionalMoney(input.flatShippingPaise);
  const threshold = optionalMoney(input.freeShippingThresholdPaise);
  if ((input.flatShippingPaise !== undefined && flat === undefined) || (input.freeShippingThresholdPaise !== undefined && threshold === undefined)) return NextResponse.json({ error: "Shipping values must be non-negative integer paise or null." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (flat !== undefined) updates.flat_shipping_paise = flat;
  if (threshold !== undefined) updates.free_shipping_threshold_paise = threshold;
  if (typeof input.checkoutEnabled === "boolean") updates.checkout_enabled = input.checkoutEnabled;
  for (const [inputKey, column, maximum] of [["businessPhone", "business_phone", 30], ["whatsappNumber", "whatsapp_number", 30], ["businessAddress", "business_address", 500]] as const) {
    if (input[inputKey] === null) updates[column] = null;
    else if (typeof input[inputKey] === "string") updates[column] = String(input[inputKey]).trim().slice(0, maximum) || null;
  }

  const admin = createAdminSupabaseClient();
  if (updates.checkout_enabled === true) {
    const { data: current } = await admin.from("store_settings").select("flat_shipping_paise").eq("settings_key", "default").single();
    const effectiveFlat = Object.hasOwn(updates, "flat_shipping_paise") ? updates.flat_shipping_paise : current?.flat_shipping_paise;
    if (effectiveFlat === null || effectiveFlat === undefined) return NextResponse.json({ error: "Configure flat shipping before enabling checkout." }, { status: 400 });
  }
  const { data, error } = await admin.rpc("admin_patch_settings",{p_actor:adminUser.id,p_patch:updates});
  return error ? NextResponse.json({ error: "Settings could not be saved. Check shipping and policy approval." }, { status: 400 }) : NextResponse.json({ settings: data });
}
