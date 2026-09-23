import { timingSafeMatch, getClientIp } from "@/lib/security";

describe("timingSafeMatch", () => {
  it("returns true for matching strings", () => {
    expect(timingSafeMatch("secret-token-12345", "secret-token-12345")).toBe(true);
    expect(timingSafeMatch("a", "a")).toBe(true);
  });

  it("returns false for non-matching strings of same length", () => {
    expect(timingSafeMatch("secret-token-12345", "secret-token-12346")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeMatch("short", "longer-string")).toBe(false);
  });

  it("returns false when either value is null or undefined or empty", () => {
    expect(timingSafeMatch(null, "secret")).toBe(false);
    expect(timingSafeMatch("secret", null)).toBe(false);
    expect(timingSafeMatch(undefined, "secret")).toBe(false);
    expect(timingSafeMatch("", "")).toBe(false);
  });
});

describe("getClientIp", () => {
  it("extracts primary IP from x-forwarded-for header with proxies", () => {
    const headers = {
      get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.195, 70.41.3.18, 150.172.238.178" : null),
    };
    expect(getClientIp(headers)).toBe("203.0.113.195");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const headers = {
      get: (name: string) => (name === "x-real-ip" ? "198.51.100.42" : null),
    };
    expect(getClientIp(headers)).toBe("198.51.100.42");
  });

  it("defaults to 127.0.0.1 when no IP headers are present", () => {
    const headers = {
      get: () => null,
    };
    expect(getClientIp(headers)).toBe("127.0.0.1");
  });
});
