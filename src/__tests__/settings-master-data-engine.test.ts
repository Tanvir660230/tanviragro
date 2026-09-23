import { appConfig } from "@/lib/config/app-config";
import { settingsService } from "@/lib/config/settings-service";
import { featureFlagEngine } from "@/lib/config/feature-flags";
import { MASTER_DATA, MASTER_BREEDS, MASTER_MEASUREMENT_UNITS } from "@/constants/master-data";
import { FARM_DEFAULTS, CACHE_TAGS, ROUTES } from "@/constants/config";

describe("Phase 10: Enterprise Settings, Configuration & Master Data Engine", () => {
  test("SettingsService returns fallback defaults for unknown business ID", async () => {
    const mockSupabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const config = await settingsService.getBusinessConfig(mockSupabase, "biz_fallback");
    expect(config.id).toBe("biz_fallback");
    expect(config.defaultDailyGainKg).toBe(FARM_DEFAULTS.DAILY_GAIN_KG);
    expect(config.defaultRoughageType).toBe("straw");
    expect(config.currency.CODE).toBe("BDT");
  });

  test("FeatureFlagEngine evaluates baseline and tenant override flags", () => {
    expect(featureFlagEngine.isEnabled("enablePushNotifications")).toBe(true);

    // Set custom override for beta business
    featureFlagEngine.setOverride("enableAdvancedAnalytics", true, "biz_beta");
    expect(featureFlagEngine.isEnabled("enableAdvancedAnalytics", { businessId: "biz_beta" })).toBe(true);

    featureFlagEngine.setOverride("enablePushNotifications", false, "biz_disabled");
    expect(featureFlagEngine.isEnabled("enablePushNotifications", { businessId: "biz_disabled" })).toBe(false);
    
    // Clean up
    featureFlagEngine.clearOverrides();
    expect(featureFlagEngine.isEnabled("enablePushNotifications", { businessId: "biz_disabled" })).toBe(true);
  });

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
