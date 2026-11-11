import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUTH_MESSAGES,
  getAuthCallbackRedirect,
  getLoginRedirect,
  getPasswordUpdateRedirect,
  resolveAuthCallbackFlow,
  safeAuthRedirectPath,
  sanitizeAuthDisplayText,
} from "../lib/auth-flow.ts";

test("password login lands each role on its own home page", () => {
  for (const next of ["", "/account", "/account/", "/account/profile", "https://example.invalid", "/.//example.invalid"]) {
    assert.equal(getLoginRedirect(next, true), "/admin");
    assert.equal(getLoginRedirect(next, false), "/account/profile");
  }
});

test("password login preserves local return paths and limits admin destinations to administrators", () => {
  for (const isAdmin of [true, false]) {
    for (const next of ["/checkout", "/account/orders?page=2", "/account/addresses"]) {
      assert.equal(getLoginRedirect(next, isAdmin), next);
    }
  }
  const adminPage = "/admin/orders?status=pending";
  assert.equal(getLoginRedirect(adminPage, true), adminPage);
  assert.equal(getLoginRedirect(adminPage, false), "/account/profile");
});

test("a verified invitation opens the existing private password-setting form", () => {
  const flow = resolveAuthCallbackFlow(null, null, "invite");
  assert.equal(new URL(getAuthCallbackRedirect(flow, true, null), "https://auth.local").pathname, "/reset-password");
  assert.equal(resolveAuthCallbackFlow(null, null, "email"), "confirmation");
  assert.match(getAuthCallbackRedirect(flow, false, null), /^\/login\?error=/);
});

test("valid confirmation reaches a success state instead of a false expired-link error", () => {
  const redirect = getAuthCallbackRedirect("confirmation", true, "/account");
  assert.equal(new URL(redirect, "https://auth.local").searchParams.get("message"), AUTH_MESSAGES.confirmationSuccess);
  assert.equal(new URL(redirect, "https://auth.local").pathname, "/account/profile");
  assert.doesNotMatch(redirect, /invalid|expired/i);
});

test("invalid or expired callbacks fail safely", () => {
  const redirect = getAuthCallbackRedirect("confirmation", false, "/account");
  const target = new URL(redirect, "https://auth.local");
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("error"), AUTH_MESSAGES.invalidCallback);
});

test("recovery callbacks reach the dedicated password-reset state", () => {
  const redirect = getAuthCallbackRedirect("recovery", true, "/account");
  const target = new URL(redirect, "https://auth.local");
  assert.equal(target.pathname, "/reset-password");
  assert.equal(target.searchParams.get("message"), AUTH_MESSAGES.recoveryReady);
  assert.doesNotMatch(redirect, /^\/login/);
});

test("successful password update completes at login with a fixed safe message", () => {
  const target = new URL(getPasswordUpdateRedirect(true), "https://auth.local");
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("message"), AUTH_MESSAGES.passwordUpdated);

  const actions = readFileSync("app/auth-actions.ts", "utf8");
  assert.match(actions, /updateUser\(\{ password \}\)/);
  assert.match(actions, /signOut\(\{ scope: "local" \}\)/);
});

test("Auth redirects reject external and backslash targets", () => {
  for (const unsafe of ["https://example.invalid", "//example.invalid/path", "/\\example.invalid/path", "javascript:alert(1)"]) {
    assert.equal(safeAuthRedirectPath(unsafe, "/account"), "/account");
  }
  assert.equal(safeAuthRedirectPath("/account/profile?tab=details#discarded"), "/account/profile?tab=details");
});

test("Auth rendering does not reflect sensitive callback material", () => {
  for (const unsafe of [
    "access_token=[redacted]",
    "refresh_token=[redacted]",
    "https://localhost/auth/callback?code=[redacted]",
    "token_hash=[redacted]",
  ]) {
    assert.equal(sanitizeAuthDisplayText(unsafe), AUTH_MESSAGES.sensitiveMessage);
  }
  assert.equal(sanitizeAuthDisplayText(AUTH_MESSAGES.invalidCallback), AUTH_MESSAGES.invalidCallback);
});

test("browser callback consumes SDK state and cleans the visible URL", () => {
  const callback = readFileSync("app/auth/callback/AuthCallbackClient.tsx", "utf8");
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /setSession\(\{/);
  assert.match(callback, /window\.history\.replaceState/);
  assert.doesNotMatch(callback, /URLSearchParams\(window\.location\.hash/);
});
