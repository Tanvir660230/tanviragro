import { getAppUrl, safeRedirectPath } from "@/lib/app-url";

describe("safeRedirectPath", () => {
  test.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/cattle?tab=weights", "/dashboard/cattle?tab=weights"],
    ["/dashboard/cattle#top", "/dashboard/cattle#top"],
  ])("allows same-site path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  test.each([
    null,
    undefined,
    "",
    "dashboard",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "@evil.com",
    "javascript:alert(1)",
    "/foo\\bar",
    "/\u0000x",
  ])("rejects %p", (input) => {
    expect(safeRedirectPath(input as string | null | undefined)).toBe("/dashboard");
  });

  test("keeps percent-encoded CR/LF encoded (no header injection)", () => {
    const out = safeRedirectPath("/%0d%0aSet-Cookie:x");
    expect(out).not.toMatch(/[\r\n]/);
    expect(out.startsWith("/")).toBe(true);
  });

  test("uses the provided fallback", () => {
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});

describe("getAppUrl", () => {
  const saved = { app: process.env.NEXT_PUBLIC_APP_URL, url: process.env.URL };
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = saved.app;
    process.env.URL = saved.url;
    if (saved.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    if (saved.url === undefined) delete process.env.URL;
  });

  test("prefers NEXT_PUBLIC_APP_URL and normalises to origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://farm.example.com/some/path";
    process.env.URL = "https://other.netlify.app";
    expect(getAppUrl()).toBe("https://farm.example.com");
  });

  test("falls back to Netlify URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.URL = "https://tanviragro.netlify.app";
    expect(getAppUrl()).toBe("https://tanviragro.netlify.app");
  });

  test("returns null when unset or invalid", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.URL;
    expect(getAppUrl()).toBeNull();
    process.env.NEXT_PUBLIC_APP_URL = "not a url";
    expect(getAppUrl()).toBeNull();
  });
});
