import { createHash } from "node:crypto";
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
let nextCleanup = 0;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function checkRateLimit(identifier: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now >= nextCleanup || buckets.size >= MAX_BUCKETS) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    nextCleanup = now + 60_000;
  }
  const key = createHash("sha256").update(identifier).digest("hex");
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (!current && buckets.size >= MAX_BUCKETS) return { allowed: false, retryAfterSeconds: 60 };
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
