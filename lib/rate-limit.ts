import { createHash } from "node:crypto";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(identifier: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const key = createHash("sha256").update(identifier).digest("hex");
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function requestIp(headerStore: Headers): string {
  return (headerStore.get("x-forwarded-for")?.split(",")[0] || headerStore.get("x-real-ip") || "local").trim().slice(0, 100);
}

export async function rateLimitCurrentRequest(scope: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return checkRateLimit(`${scope}:${requestIp(await headers())}`, limit, windowMs);
}

export function rateLimitRequest(request: Request, scope: string, limit: number, windowMs: number): RateLimitResult {
  return checkRateLimit(`${scope}:${requestIp(request.headers)}`, limit, windowMs);
}
