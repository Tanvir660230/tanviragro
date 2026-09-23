import { FARM_DEFAULTS, CACHE_TAGS, ROUTES } from "@/constants/config";
import { CURRENCY, DEFAULT_FISCAL_YEAR_START_MONTH } from "@/constants/financial";
import { MASTER_DATA } from "@/constants/master-data";
import { featureFlagEngine } from "./feature-flags";
import { settingsService } from "./settings-service";

export const appConfig = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  auth: {
    cookieName: "sb-auth-token",
    sessionExpirySeconds: 60 * 60 * 24 * 7, // 7 days
  },
  farm: {
    ...FARM_DEFAULTS,
    currency: CURRENCY,
    fiscalYearStartMonth: DEFAULT_FISCAL_YEAR_START_MONTH,
  },
  cache: CACHE_TAGS,
  routes: ROUTES,
  masterData: MASTER_DATA,
  featureFlags: {
    enablePushNotifications: true,
    enableTelemetryProbes: true,
    enableIslamicPartnershipVesting: true,
    enableFifoInventoryDeduction: true,
  },
} as const;

export { featureFlagEngine, settingsService };
export type AppConfig = typeof appConfig;

