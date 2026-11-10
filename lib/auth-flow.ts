export type AuthCallbackFlow = "confirmation" | "recovery";

export const AUTH_MESSAGES = {
  confirmationSuccess: "Email confirmed. Welcome to your account.",
  recoveryReady: "Recovery link verified. Choose a new password.",
  invalidCallback: "This confirmation or recovery link is invalid or expired.",
  passwordUpdated: "Password updated. You can now log in.",
  passwordUpdateFailed: "Unable to update the password. Please request a new reset link.",
  passwordPolicy: "Passwords must match and contain at least 8 characters.",
  resetEmailRateLimited: "Email service is temporarily rate-limited. Try again later.",
  resetEmailFailed: "Unable to send a reset email right now. Try again later.",
  signupFailed: "Unable to create the account right now. Try again later.",
  sensitiveMessage: "Unable to display authentication details safely. Please request a new link.",
} as const;

const LOCAL_AUTH_BASE = "https://auth.local";
const SENSITIVE_AUTH_MATERIAL =
  /access[_-]?token|refresh[_-]?token|token[_-]?hash|code[_-]?verifier|(?:^|[?&#])code=|(?:^|\W)otp(?:\W|$)|(?:^|\W)jwt(?:\W|$)|eyJ[A-Za-z0-9_-]{10,}|https?:\/\/\S*[#?]\S+/i;

export function safeAuthRedirectPath(value: string | null | undefined, fallback = "/account"): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const target = new URL(value, LOCAL_AUTH_BASE);
    if (target.origin !== LOCAL_AUTH_BASE) return fallback;
    return `${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}

export function resolveAuthCallbackFlow(
  value: string | null | undefined,
  next: string | null | undefined,
  otpType?: string | null,
): AuthCallbackFlow {
  if (otpType === "recovery" || otpType === "invite" || safeAuthRedirectPath(next, "") === "/reset-password") return "recovery";
  return value === "recovery" ? "recovery" : "confirmation";
}

export function withAuthMessage(path: string, key: "error" | "message", message: string): string {
  const target = new URL(safeAuthRedirectPath(path, "/login"), LOCAL_AUTH_BASE);
  target.searchParams.set(key, message);
  return `${target.pathname}${target.search}`;
}

export function authCallbackPath(flow: AuthCallbackFlow, next: string): string {
  const target = new URL("/auth/callback", LOCAL_AUTH_BASE);
  target.searchParams.set("flow", flow);
  target.searchParams.set("next", safeAuthRedirectPath(next));
  return `${target.pathname}${target.search}`;
}

export function getAuthCallbackRedirect(
  flow: AuthCallbackFlow,
  succeeded: boolean,
  requestedNext?: string | null,
): string {
  if (!succeeded) return withAuthMessage("/login", "error", AUTH_MESSAGES.invalidCallback);

  if (flow === "recovery") {
    return withAuthMessage("/reset-password", "message", AUTH_MESSAGES.recoveryReady);
  }

  const requested = safeAuthRedirectPath(requestedNext, "/account/profile");
  const destination = requested === "/account" ? "/account/profile" : requested;
  return withAuthMessage(destination, "message", AUTH_MESSAGES.confirmationSuccess);
}

export function getPasswordUpdateRedirect(succeeded: boolean): string {
  return succeeded
    ? withAuthMessage("/login", "message", AUTH_MESSAGES.passwordUpdated)
    : withAuthMessage("/reset-password", "error", AUTH_MESSAGES.passwordUpdateFailed);
}

export function isAuthEmailRateLimit(error: { code?: string; status?: number } | null): boolean {
  return error?.status === 429 || error?.code === "over_email_send_rate_limit";
}

export function sanitizeAuthDisplayText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (SENSITIVE_AUTH_MATERIAL.test(value)) return AUTH_MESSAGES.sensitiveMessage;
  return value.slice(0, 300);
}
