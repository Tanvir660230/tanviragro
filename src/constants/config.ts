/** Product name shown in titles, emails and alerts. */
export const APP_NAME = "Tanvir Agro";
export const APP_FULL_NAME = `${APP_NAME} ERP`;

/**
 * Farm operational defaults, biometrics & system thresholds
 */

export const FARM_DEFAULTS = {
  DAILY_GAIN_KG: 0.6,
  DRY_MATTER_RATIO: 0.028, // 2.8% of body weight
  CONCENTRATE_DM_PCT: 0.90, // 90% Dry Matter in concentrate
  ROUGHAGE_DM_PCT: 0.85, // 85% Dry Matter in dry straw
  ROUGHAGE_FRESH_DM_PCT: 0.25, // 25% Dry Matter in green grass
  LOW_STOCK_THRESHOLD_DEFAULT: 50.0,
  UNWEIGHED_ALERT_DAYS: 7,
  VACCINE_DUE_ALERT_DAYS: 14,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 25,
} as const;

export const CACHE_TAGS = {
  ACCOUNTING: "accounting",
  CATTLE: "cattle",
  INVENTORY: "inventory",
  HEALTH: "health",
  PARTNERS: "partners",
  SETTINGS: "settings",
} as const;

export const ROUTES = {
  DASHBOARD: "/dashboard",
  CATTLE: "/dashboard/cattle",
  INVENTORY: "/dashboard/inventory",
  FINANCE: "/dashboard/finance",
  ACCOUNTING: "/dashboard/accounting",
  PARTNERS: "/dashboard/partners",
  COMPLIANCE: "/dashboard/compliance",
  OPERATIONS: "/dashboard/operations",
  NOTIFICATIONS: "/dashboard/notifications",
  REPORTS: "/dashboard/report",
  SETTINGS: "/dashboard/settings",
  LOGIN: "/login",
} as const;
