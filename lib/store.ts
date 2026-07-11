import { siteConfig } from "@/lib/site";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export type PublicStoreSettings = {
  checkoutEnabled: boolean;
  guestCheckoutEnabled: boolean;
  productOrderingEnabled: boolean;
  flatShippingPaise: number | null;
  freeShippingThresholdPaise: number | null;
  businessPhone: string | null;
  whatsappNumber: string | null;
  businessAddress: string | null;
  shippingNotice: string | null;
  maintenanceNotice: string | null;
  databaseConfigured: boolean;
};

export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase.from("store_settings").select("checkout_enabled, guest_checkout_enabled, product_ordering_enabled, flat_shipping_paise, free_shipping_threshold_paise, shipping_notice, business_phone, whatsapp_number, business_address, maintenance_notice").eq("settings_key", "default").single();
    if (error || !data) throw error || new Error("Store settings not found.");
    return {
      checkoutEnabled: data.checkout_enabled && data.product_ordering_enabled && data.flat_shipping_paise !== null,
      guestCheckoutEnabled: data.guest_checkout_enabled,
      productOrderingEnabled: data.product_ordering_enabled,
      flatShippingPaise: data.flat_shipping_paise,
      freeShippingThresholdPaise: data.free_shipping_threshold_paise,
      businessPhone: data.business_phone,
      whatsappNumber: data.whatsapp_number || siteConfig.whatsappNumber || null,
      businessAddress: data.business_address,
      shippingNotice: data.shipping_notice,
      maintenanceNotice: data.maintenance_notice,
      databaseConfigured: true,
    };
  } catch {
    return {
      checkoutEnabled: false,
      guestCheckoutEnabled: true,
      productOrderingEnabled: true,
      flatShippingPaise: null,
      freeShippingThresholdPaise: null,
      businessPhone: null,
      whatsappNumber: siteConfig.whatsappNumber || null,
      businessAddress: null,
      shippingNotice: null,
      maintenanceNotice: null,
      databaseConfigured: false,
    };
  }
}
