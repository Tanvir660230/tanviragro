/**
 * Canonical public URL of the deployed app.
 * NEXT_PUBLIC_APP_URL wins; Netlify's built-in `URL` (primary site URL) is the fallback.
 * Returns null when neither is configured so callers can fail loudly instead of guessing.
 */
export function getAppUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Returns `path` only if it is a same-site relative path ("/dashboard/cattle?x=1").
 * Rejects absolute URLs, protocol-relative ("//evil.com"), backslash tricks ("/\evil.com"),
 * userinfo tricks ("@evil.com") and control characters. Falls back to `fallback`.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path || typeof path !== "string") return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(path)) return fallback;
  try {
    // Resolve against a dummy origin; anything that changes the origin is rejected.
    const resolved = new URL(path, "https://app.invalid");
    if (resolved.origin !== "https://app.invalid") return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}
