import fs from "fs";
import path from "path";
import { SITE, ALL_HREFS, activeHref, sectionOf } from "@/components/navigation/site-map";
import { ENTERPRISE_NAV_CONFIG, isNavActive } from "@/components/navigation/nav-config";

// THE site map drives the sidebar, the phone menu, the section tabs and search.
const APP = path.join(__dirname, "..", "app", "dashboard", "(app)");
const pageExists = (href: string) => {
  const rel = href.replace(/^\/dashboard\/?/, "");
  return fs.existsSync(path.join(APP, rel, "page.tsx"));
};

describe("site map", () => {
  test("every menu link opens a real page", () => {
    const missing = ALL_HREFS.filter((h) => !pageExists(h));
    expect(missing).toEqual([]);
  });

  test("hrefs and ids are unique; every section has Bangla and English names", () => {
    expect(new Set(SITE.map((s) => s.id)).size).toBe(SITE.length);
    for (const s of SITE) {
      expect(s.label.bn && s.label.en).toBeTruthy();
      const hrefs = s.pages.map((p) => p.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const p of s.pages) expect(p.label.bn && p.label.en).toBeTruthy();
      // the section's first page is the section home
      if (s.pages.length) expect(s.pages[0].href).toBe(s.href);
    }
  });

  test("at most 4 sections in the phone's bottom bar", () => {
    expect(SITE.filter((s) => s.bottomBar).length).toBeLessThanOrEqual(4);
  });

  test("the most specific page is active, not its parent", () => {
    expect(activeHref("/dashboard")).toBe("/dashboard");
    expect(activeHref("/dashboard/inventory/purchase/history")).toBe("/dashboard/inventory/purchase/history");
    expect(activeHref("/dashboard/inventory/purchase")).toBe("/dashboard/inventory/purchase");
    expect(activeHref("/dashboard/cattle/abc-123")).toBe("/dashboard/cattle");
    expect(activeHref("/dashboard/nowhere")).toBeNull();
  });

  test("a page belongs to its section (vaccine report sits under health)", () => {
    expect(sectionOf("/dashboard/compliance")?.id).toBe("health");
    expect(sectionOf("/dashboard/notifications")?.id).toBe("settings");
    expect(sectionOf("/dashboard/inventory/mix")?.id).toBe("inventory");
  });

  test("the sidebar is built from the site map", () => {
    const sidebar = ENTERPRISE_NAV_CONFIG.flatMap((g) => g.items.map((i) => i.href));
    expect(sidebar).toEqual(SITE.map((s) => s.href));
    expect(isNavActive("/dashboard", "/dashboard/cattle")).toBe(false);
    expect(isNavActive("/dashboard/cattle", "/dashboard/cattle/qurbani")).toBe(true);
    expect(isNavActive("/dashboard/cattle", "/dashboard/cattlex")).toBe(false);
  });

  test("no menu or search still points at a deleted page", () => {
    const files = [
      "components/shared/BottomNav.tsx",
      "components/layout/QuickCreateMenu.tsx",
      "components/layout/GlobalCommandSearch.tsx",
      "components/navigation/MobileSidebarDrawer.tsx",
    ].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
    for (const src of files) {
      expect(src).not.toMatch(/\/dashboard\/(vendors|operations|commerce|breeding|reports\b|help)/);
    }
  });
});
