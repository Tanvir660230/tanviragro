/**
 * Simple sliding-window in-memory rate limiter.
 * Works per-process — sufficient for a single-instance farm ERP.
 * For multi-instance deploys, swap backing store for Redis/Upstash.
 */

interface Window {
  count: number;
  windowStart: number;
}

const store = new Map<string, Window>();

// Clean up stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (now - win.windowStart > 3600_000) store.delete(key);
  }
}, 300_000);

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique identifier (e.g. `userId:route`)
 * @param limit    Max requests per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const win = store.get(key);

  if (!win || now - win.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (win.count >= limit) return false;
  win.count++;
  return true;
}
