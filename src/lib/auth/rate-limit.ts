import type { NextRequest } from "next/server";

/**
 * Lightweight in-memory token-bucket rate limiter.
 *
 * NOTE: This is intentionally process-local. On a single-instance Render
 * deploy that's enough to stop casual abuse / accidental floods. If you
 * scale to multiple instances, swap this for Upstash Ratelimit (Redis) or
 * an equivalent shared store.
 *
 * Buckets are keyed by `${name}:${ip|email}`. Each bucket allows
 * `limit` requests per `windowMs` window. State is best-effort: entries
 * older than 2× the window are evicted lazily.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, bucket);
    cleanup(now);
    return { ok: true, remaining: options.limit - 1, resetAt: bucket.resetAt };
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60_000;

function cleanup(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt + CLEANUP_INTERVAL_MS < now) {
      buckets.delete(key);
    }
  }
}

/**
 * Best-effort client IP extraction. We can't trust headers blindly, but
 * Render and most hosting platforms set `x-forwarded-for` to a comma-
 * separated list whose first entry is the original client.
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
