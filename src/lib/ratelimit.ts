import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Press Farm OS — rate limiting for the PUBLIC (unauthenticated) endpoints.
 *
 * Only the open-to-the-internet routes need this: `/api/contact` and
 * `/api/auth/signup`. Everything else is gated by auth, so abuse there is
 * already bounded.
 *
 * Backed by Upstash Redis over HTTP — the REST client works on Vercel's
 * serverless functions (no long-lived TCP connection to pool). Configured via
 * two env vars (copy them from the "REST API" box in the Upstash console):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * FAIL-OPEN by design. When the env vars are absent (local dev, preview, or
 * before they're set in prod) OR Upstash is unreachable, requests are ALLOWED.
 * A signup/contact page that hard-fails because a cache is momentarily down is
 * worse than briefly having no rate limit. This also means the feature ships
 * completely inert and turns on only once the env vars are configured.
 */

let redisClient: Redis | null | undefined; // undefined = not yet resolved
const limiterCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function getLimiter(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${name}:${limit}:${windowSeconds}`;
  let limiter = limiterCache.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `pf-rl:${name}`,
      analytics: false,
    });
    limiterCache.set(key, limiter);
  }
  return limiter;
}

/** Best-effort client IP from the proxy/Vercel headers. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  /** true = allow the request through. */
  ok: boolean;
  remaining: number;
  limit: number;
}

/**
 * Check (and consume) one request against the named limit, keyed by client IP.
 * Returns `{ ok: true }` (allow) whenever rate limiting isn't configured or
 * errors — fail-open.
 */
export async function rateLimit(
  request: Request,
  opts: { name: string; limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const limiter = getLimiter(opts.name, opts.limit, opts.windowSeconds);
  if (!limiter) return { ok: true, remaining: opts.limit, limit: opts.limit };
  try {
    const res = await limiter.limit(clientIp(request));
    return { ok: res.success, remaining: res.remaining, limit: res.limit };
  } catch (err) {
    console.warn("[ratelimit] check failed — allowing request (fail-open):", err);
    return { ok: true, remaining: opts.limit, limit: opts.limit };
  }
}
