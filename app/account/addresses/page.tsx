import { createAddressAction, deleteAddressAction, setDefaultAddressAction, updateAddressAction } from "@/app/account/actions";
import { AddressFields } from "@/components/account/AddressFields";
import { AuthMessage } from "@/components/auth/AuthShell";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [query, user] = await Promise.all([searchParams, requireUser("/account/addresses")]);
  const supabase = await createServerSupabaseClient();
  const { data: addresses } = await supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
  return (
    <section className="account-panel">
      <p className="eyebrow">Addresses</p><h2>Delivery addresses</h2>
      <AuthMessage error={query.error} message={query.message} />
      <div className="address-list">
        {addresses?.map((address) => (
          <article className="address-card" key={address.id}>
            <div><h3>{address.recipient_name} {address.is_default ? <span className="status-badge">Default</span> : null}</h3><p>{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}<br />{address.city}, {address.state} {address.postal_code}<br />{address.phone}</p></div>
            <div className="address-actions">
              {!address.is_default ? <form action={setDefaultAddressAction}><input type="hidden" name="id" value={address.id} /><button className="text-button" type="submit">Make default</button></form> : null}
              <form action={deleteAddressAction}><input type="hidden" name="id" value={address.id} /><button className="text-button" type="submit">Delete</button></form>
            </div>
            <details><summary>Edit address</summary><form className="form-stack" action={updateAddressAction}><input type="hidden" name="id" value={address.id} /><AddressFields address={{ ...address, is_default: String(address.is_default) }} /><button className="button button--secondary" type="submit">Update address</button></form></details>
          </article>
        ))}
      </div>
      <div className="account-subpanel"><h3>Add an address</h3><form className="form-stack" action={createAddressAction}><AddressFields /><button className="button" type="submit">Save address</button></form></div>
    </section>
  );
}
