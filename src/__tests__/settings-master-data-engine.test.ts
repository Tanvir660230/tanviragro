import { MASTER_DATA, MASTER_BREEDS, MASTER_MEASUREMENT_UNITS } from "@/constants/master-data";
import { FARM_DEFAULTS, CACHE_TAGS, ROUTES } from "@/constants/config";

describe("Phase 10: Enterprise Settings, Configuration & Master Data Engine", () => {
  test("Master Data repository provides uniform breeds, units, and categories across ERP", () => {
    expect(MASTER_DATA.breeds.length).toBeGreaterThanOrEqual(10);
    expect(MASTER_DATA.breeds).toContain("Sahiwal");
    expect(MASTER_DATA.breeds).toContain("Red Chittagong Cattle (RCC)");

    expect(MASTER_DATA.units.some((u) => u.code === "KG")).toBe(true);
    expect(MASTER_DATA.units.some((u) => u.code === "LTR")).toBe(true);

    expect(MASTER_DATA.defaults.DAILY_GAIN_KG).toBe(0.6);
    expect(MASTER_DATA.cacheTags.SETTINGS).toBe("settings");
  });
});
