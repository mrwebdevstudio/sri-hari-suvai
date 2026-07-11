import { updateSettingsAction } from "@/app/admin/actions";
import { AdminNotice, AdminPageHeader, StatusBadge } from "@/components/admin/AdminUi";
import { formatPaiseAsRupees } from "@/lib/admin";
import { getAdminSettings } from "@/lib/admin-data";

type Query = { message?: string; error?: string };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [settings, query] = await Promise.all([getAdminSettings(), searchParams]);
  const shippingConfigured = settings.flat_shipping_paise !== null;
  return (
    <>
      <AdminPageHeader eyebrow="Store configuration" title="Store settings" description="Operational values only. Provider secrets remain server environment variables." />
      <AdminNotice message={query.message} error={query.error} />
      <div className="admin-signal-grid admin-settings-signals">
        <article><strong>Online checkout</strong><StatusBadge value={settings.checkout_enabled ? "enabled" : "disabled"} /><p>{shippingConfigured ? "Shipping is configured." : "Checkout must remain disabled until shipping is configured."}</p></article>
        <article><strong>Policy approval</strong><StatusBadge value={settings.policies_approved ? "approved" : "pending"} /><p>This flag records owner approval only; no legal content is generated.</p></article>
        <article><strong>Email webhook</strong><StatusBadge value={process.env.EMAIL_WEBHOOK_URL ? "configured" : "missing"} /><p>Configuration presence only. Delivery is not assumed.</p></article>
      </div>
      <form className="admin-form admin-settings-form" action={updateSettingsAction}>
        <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Ordering</p><h2>Checkout controls</h2></div></div><div className="admin-form-grid">
          <label className="admin-check"><input name="productOrderingEnabled" type="checkbox" defaultChecked={settings.product_ordering_enabled} /><span>Product ordering enabled</span></label>
          <label className="admin-check"><input name="checkoutEnabled" type="checkbox" defaultChecked={settings.checkout_enabled} /><span>Online checkout enabled</span></label>
          <label className="admin-check"><input name="guestCheckoutEnabled" type="checkbox" defaultChecked={settings.guest_checkout_enabled} /><span>Guest checkout enabled</span></label>
          <label>Flat shipping (₹)<input name="flatShippingRupees" inputMode="decimal" defaultValue={settings.flat_shipping_paise === null ? "" : formatPaiseAsRupees(settings.flat_shipping_paise)} /></label>
          <label>Free-shipping threshold (₹)<input name="freeShippingThresholdRupees" inputMode="decimal" defaultValue={settings.free_shipping_threshold_paise === null ? "" : formatPaiseAsRupees(settings.free_shipping_threshold_paise)} /></label>
          <label>Low-stock threshold<input name="lowStockThreshold" type="number" min="0" step="1" defaultValue={settings.low_stock_threshold ?? ""} /></label>
          <label className="admin-form-span">Shipping notice<textarea name="shippingNotice" maxLength={500} defaultValue={settings.shipping_notice || ""} /></label>
          <label className="admin-form-span">Serviceable PIN codes<textarea name="serviceablePostalCodes" defaultValue={(settings.serviceable_postal_codes || []).join(", ")} /><span>Comma or space separated six-digit Indian PIN codes. Leave blank for no configured restriction.</span></label>
        </div></section>

        <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Contact</p><h2>Business details</h2></div></div><div className="admin-form-grid">
          <label>Primary phone<input name="primaryPhone" type="tel" defaultValue={settings.business_phone || ""} /></label>
          <label>Secondary phone<input name="secondaryPhone" type="tel" defaultValue={settings.secondary_phone || ""} /></label>
          <label>WhatsApp number<input name="whatsappNumber" type="tel" defaultValue={settings.whatsapp_number || ""} /></label>
          <label className="admin-form-span">Business address<textarea name="businessAddress" maxLength={500} defaultValue={settings.business_address || ""} /></label>
          <label className="admin-form-span">Storefront maintenance notice<textarea name="maintenanceNotice" maxLength={500} defaultValue={settings.maintenance_notice || ""} /></label>
        </div></section>

        <section className="admin-section"><div className="admin-section-head"><div><p className="eyebrow">Lifecycle hooks</p><h2>Notifications and approvals</h2></div></div><div className="admin-check-grid">
          <label className="admin-check"><input name="orderEmailHookEnabled" type="checkbox" defaultChecked={settings.order_email_hook_enabled} /><span>Order lifecycle email hook enabled</span></label>
          <label className="admin-check"><input name="shippingEmailHookEnabled" type="checkbox" defaultChecked={settings.shipping_email_hook_enabled} /><span>Shipping email hook enabled</span></label>
          <label className="admin-check"><input name="policiesApproved" type="checkbox" defaultChecked={settings.policies_approved} /><span>Owner confirms required policies are approved</span></label>
        </div></section>
        <div className="admin-sticky-save"><button className="button" type="submit">Save store settings</button></div>
      </form>
    </>
  );
}
