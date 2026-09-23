import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-client-${Date.now()}`;
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
  });

  it("blocks requests exceeding the limit", () => {
    const key = `test-blocked-${Date.now()}`;
    expect(rateLimit(key, 2, 1000)).toBe(true);
    expect(rateLimit(key, 2, 1000)).toBe(true);
    expect(rateLimit(key, 2, 1000)).toBe(false);
  });

  it("resets window after expiration", async () => {
    const key = `test-reset-${Date.now()}`;
    expect(rateLimit(key, 1, 50)).toBe(true);
    expect(rateLimit(key, 1, 50)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(rateLimit(key, 1, 50)).toBe(true);
  });
});
