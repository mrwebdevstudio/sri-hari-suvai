"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { absoluteUrl } from "@/lib/site";
import { rateLimitCurrentRequest } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPhone, normalizePhone } from "@/lib/validation";

function field(formData: FormData, name: string, maximum = 254): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeNextPath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function withMessage(path: string, key: "error" | "message", value: string): string {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

export async function loginAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-login", 8, 15 * 60_000);
  if (!rate.allowed) redirect(withMessage("/login", "error", "Too many login attempts. Try again later."));
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password", 200);
  const next = safeNextPath(field(formData, "next", 500));
  if (!email || !password) redirect(withMessage("/login", "error", "Email and password are required."));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(withMessage("/login", "error", "Email or password is incorrect."));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signupAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-signup", 5, 60 * 60_000);
  if (!rate.allowed) redirect(withMessage("/signup", "error", "Too many signup attempts. Try again later."));
  const fullName = field(formData, "fullName", 100);
  const phone = normalizePhone(formData.get("phone"));
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password", 200);
  if (!fullName || !email || password.length < 8) {
    redirect(withMessage("/signup", "error", "Enter your name, email, and a password of at least 8 characters."));
  }
  if (phone && !isValidPhone(phone)) redirect(withMessage("/signup", "error", "Enter a valid phone number."));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, ...(phone ? { phone } : {}) },
      emailRedirectTo: absoluteUrl("/auth/confirm?next=/account"),
    },
  });
  if (error) redirect(withMessage("/signup", "error", error.message));
  if (data.session) redirect("/account");
  redirect(withMessage("/login", "message", "Check your email to confirm your account."));
}

export async function forgotPasswordAction(formData: FormData) {
  const rate = await rateLimitCurrentRequest("auth-password-reset", 5, 60 * 60_000);
  if (!rate.allowed) redirect(withMessage("/forgot-password", "message", "If the account exists, a reset link has been sent."));
  const email = field(formData, "email").toLowerCase();
  if (!email) redirect(withMessage("/forgot-password", "error", "Email is required."));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl("/auth/confirm?next=/reset-password"),
  });
  if (error) redirect(withMessage("/forgot-password", "error", error.message));
  redirect(withMessage("/forgot-password", "message", "If the account exists, a reset link has been sent."));
}

export async function resetPasswordAction(formData: FormData) {
  const password = field(formData, "password", 200);
  const confirmation = field(formData, "passwordConfirmation", 200);
  if (password.length < 8 || password !== confirmation) {
    redirect(withMessage("/reset-password", "error", "Passwords must match and contain at least 8 characters."));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(withMessage("/reset-password", "error", error.message));
  redirect(withMessage("/login", "message", "Password updated. You can now log in."));
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
