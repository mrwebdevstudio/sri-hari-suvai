"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AUTH_MESSAGES,
  authCallbackPath,
  getAuthCallbackRedirect,
  getPasswordUpdateRedirect,
  isAuthEmailRateLimit,
  safeAuthRedirectPath,
  withAuthMessage,
} from "@/lib/auth-flow";
import { absoluteUrl } from "@/lib/site";
import { rateLimitCurrentRequest } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPhone, normalizePhone } from "@/lib/validation";

function field(formData: FormData, name: string, maximum = 254): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function loginAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-login", 8, 15 * 60_000);
  if (!rate.allowed) redirect(withAuthMessage("/login", "error", "Too many login attempts. Try again later."));
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password", 200);
  const next = safeAuthRedirectPath(field(formData, "next", 500));
  if (!email || !password) redirect(withAuthMessage("/login", "error", "Email and password are required."));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(withAuthMessage("/login", "error", "Email or password is incorrect."));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signupAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-signup", 5, 60 * 60_000);
  if (!rate.allowed) redirect(withAuthMessage("/signup", "error", "Too many signup attempts. Try again later."));
  const fullName = field(formData, "fullName", 100);
  const phone = normalizePhone(formData.get("phone"));
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password", 200);
  if (!fullName || !email || password.length < 8) {
    redirect(withAuthMessage("/signup", "error", "Enter your name, email, and a password of at least 8 characters."));
  }
  if (phone && !isValidPhone(phone)) redirect(withAuthMessage("/signup", "error", "Enter a valid phone number."));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...(phone ? { phone } : {}) },
      emailRedirectTo: absoluteUrl(authCallbackPath("confirmation", "/account/profile")),
    },
  });
  if (error) redirect(withAuthMessage("/signup", "error", AUTH_MESSAGES.signupFailed));
  if (data.session) redirect(getAuthCallbackRedirect("confirmation", true, "/account/profile"));
  redirect(withAuthMessage("/login", "message", "Check your email to confirm your account."));
}

export async function forgotPasswordAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-password-reset", 5, 60 * 60_000);
  if (!rate.allowed) redirect(withAuthMessage("/forgot-password", "message", "If the account exists, a reset link has been sent."));
  const email = field(formData, "email").toLowerCase();
  if (!email) redirect(withAuthMessage("/forgot-password", "error", "Email is required."));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl(authCallbackPath("recovery", "/reset-password")),
  });
  if (error) {
    const message = isAuthEmailRateLimit(error) ? AUTH_MESSAGES.resetEmailRateLimited : AUTH_MESSAGES.resetEmailFailed;
    redirect(withAuthMessage("/forgot-password", "error", message));
  }
  redirect(withAuthMessage("/forgot-password", "message", "If the account exists, a reset link has been sent."));
}

export async function resetPasswordAction(formData: FormData) {
  const password = field(formData, "password", 200);
  const confirmation = field(formData, "passwordConfirmation", 200);
  if (password.length < 8 || password !== confirmation) {
    redirect(withAuthMessage("/reset-password", "error", AUTH_MESSAGES.passwordPolicy));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(getPasswordUpdateRedirect(false));
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect(getPasswordUpdateRedirect(true));
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
