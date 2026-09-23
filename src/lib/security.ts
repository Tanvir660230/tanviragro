import crypto from "crypto";

/**
 * Constant-time string comparison to defend against timing attacks on secrets and bearer tokens.
 */
export function timingSafeMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Constant time dummy comparison to avoid length leakage
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extract client IP securely from request headers.
 */
export function getClientIp(headersList: Headers | { get(name: string): string | null }): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return headersList.get("x-real-ip") || "127.0.0.1";
}
