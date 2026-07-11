import { updateProfileAction } from "@/app/account/actions";
import { AuthMessage } from "@/components/auth/AuthShell";
import { requireUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [query, user] = await Promise.all([searchParams, requireUser("/account/profile")]);
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single();
  return (
    <section className="account-panel">
      <p className="eyebrow">Profile</p><h2>Your details</h2>
      <AuthMessage error={query.error} message={query.message} />
      <form className="form-stack" action={updateProfileAction}>
        <label>Full name<input name="fullName" defaultValue={profile?.full_name || ""} autoComplete="name" maxLength={100} required /></label>
        <label>Email<input value={user.email || ""} disabled /></label>
        <label>Phone<input name="phone" defaultValue={profile?.phone || ""} type="tel" autoComplete="tel" /></label>
        <button className="button" type="submit">Save profile</button>
      </form>
    </section>
  );
}
