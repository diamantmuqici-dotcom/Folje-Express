/**
 * In-memory sliding-window rate limiter.
 * Works per server instance (edge or node). On serverless each instance has
 * its own bucket map — combined with the platform's own edge protection this
 * is an effective first line of defence against floods, scraping and
 * brute-force attacks without any external service.
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds
};

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

const SWEEP_INTERVAL = 60_000;
const MAX_KEYS = 20_000; // hard cap so the map itself can't be used to exhaust memory

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0) buckets.delete(key);
  }
  // If we are still over the cap, drop the oldest-touched entries.
  if (buckets.size > MAX_KEYS) {
    const entries = [...buckets.entries()].sort(
      (a, b) => (a[1].hits[0] ?? 0) - (b[1].hits[0] ?? 0)
    );
    for (let i = 0; i < entries.length - MAX_KEYS / 2; i++) buckets.delete(entries[i][0]);
  }
}

/**
 * Register one hit for `key` and report whether it is allowed.
 * @param key    identifier (usually route + ip)
 * @param limit  max hits inside the window
 * @param windowMs window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  // Drop hits outside the window.
  const cutoff = now - windowMs;
  while (bucket.hits.length && bucket.hits[0] <= cutoff) bucket.hits.shift();

  if (bucket.hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }
  bucket.hits.push(now);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfter: 0 };
}

/** Check without consuming a hit. */
export function peekLimit(key: string, limit: number, windowMs: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return true;
  const cutoff = Date.now() - windowMs;
  return bucket.hits.filter((t) => t > cutoff).length < limit;
}

/** Standard 429 response. */
export function tooManyRequests(retryAfter: number, message = "Shumë kërkesa. Provo përsëri pas pak.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store",
    },
  });
}

/** Extract a client IP from a Request (works on Vercel edge + node). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}
