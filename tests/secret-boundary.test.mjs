import assert from "node:assert/strict";
import test from "node:test";
import { logger } from "../lib/logger.ts";

// A synthetic value only. Never load .env.local into the test logger.
const marker = ["sb", "secret", "regression_only"].join("_");

test("nested diagnostics cannot print a modern Supabase secret or API key", (t) => {
  const output = t.mock.method(console, "error", () => {});
  logger.error("storage.failed", { nested: { detail: "Authorization: " + marker, apiKey: "nested-test-value" } });
  const [entry] = output.mock.calls[0].arguments;
  assert.ok(entry.includes("storage.failed"));
  assert.ok(!entry.includes(marker));
  assert.ok(!entry.includes("nested-test-value"));
});

test("Next refuses to bundle a secret from a public environment variable", async () => {
  const name = "NEXT_PUBLIC_BOUNDARY_TEST";
  const previous = process.env[name];
  try {
    process.env[name] = marker;
    await assert.rejects(import("../next.config.ts?public-secret-regression"), /public environment variable contains a server credential/);
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});
