export function AddressFields({ address }: { address?: Record<string, string | null> }) {
  return (
    <>
      <label>Full name<input name="name" defaultValue={address?.recipient_name || ""} autoComplete="name" maxLength={100} required /></label>
      <label>Phone<input name="phone" defaultValue={address?.phone || ""} type="tel" autoComplete="tel" required /></label>
      <label>Address<input name="addressLine1" defaultValue={address?.address_line_1 || ""} autoComplete="address-line1" maxLength={200} required /></label>
      <label>Address line 2 <span>(optional)</span><input name="addressLine2" defaultValue={address?.address_line_2 || ""} autoComplete="address-line2" maxLength={200} /></label>
      <div className="form-grid">
        <label>City<input name="city" defaultValue={address?.city || ""} autoComplete="address-level2" required /></label>
        <label>State<input name="state" defaultValue={address?.state || ""} autoComplete="address-level1" required /></label>
        <label>Postal code<input name="postalCode" defaultValue={address?.postal_code || ""} autoComplete="postal-code" required /></label>
      </div>
      <label className="checkbox-field"><input name="isDefault" type="checkbox" defaultChecked={address?.is_default === "true"} /> Use as default address</label>
    </>
  );
}
