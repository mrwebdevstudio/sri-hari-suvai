import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthCallbackRedirect, resolveAuthCallbackFlow } from "@/lib/auth-flow";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function supportedOtpType(value: string | null): EmailOtpType | null {
  return value === "email" || value === "recovery" || value === "invite" ? value : null;
}

function redirectWithoutAuthState(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = params.get("next");
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = supportedOtpType(params.get("type"));
  const flow = resolveAuthCallbackFlow(params.get("flow"), next, type);
  const supabase = await createServerSupabaseClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    return redirectWithoutAuthState(request, getAuthCallbackRedirect(flow, !error && Boolean(data.session), next));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return redirectWithoutAuthState(request, getAuthCallbackRedirect(flow, !error, next));
  }

  return redirectWithoutAuthState(request, getAuthCallbackRedirect(flow, false, next));
}
