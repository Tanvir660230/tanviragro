/**
 * Enterprise Master Data Definitions
 * Central authoritative repository for standard system taxonomies, breeds, categories, units, and statuses.
 */

import { CATTLE_STATUSES, CATTLE_STATUS_LABELS, LOAN_STATUS_LABELS } from "./status";
import { 
  COST_TYPES, 
  COST_ENTRY_CLASSES, 
  INVENTORY_CATEGORIES, 
  PARTNER_TYPES, 
  PARTNER_TXN_TYPES, 
  ROUGHAGE_TYPES, 
  DEPRECIATION_METHODS, 
  FIXED_EXPENSE_CATEGORIES, 
  VARIABLE_EXPENSE_CATEGORIES, 
  CURRENCY,
  DEFAULT_FISCAL_YEAR_START_MONTH
} from "./financial";
import { HEALTH_EVENT_TYPES, DLS_VACCINE_SCHEDULE, DEFAULT_DEWORMING_INTERVAL_DAYS, DEFAULT_QUARANTINE_DAYS } from "./health";
import { FARM_DEFAULTS, CACHE_TAGS, ROUTES } from "./config";
import { USER_ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_HIERARCHY } from "./roles";

export const MASTER_BREEDS = [
  "Brahman",
  "Crossbred",
  "Frieswal",
  "Hariana",
  "Indigenous (Deshi)",
  "Nellore",
  "Ongole",
  "Red Chittagong Cattle (RCC)",
  "Sahiwal",
  "Sindhi",
  "Sirohi",
  "Tharparkar",
] as const;
export type MasterBreed = typeof MASTER_BREEDS[number] | string;

export const MASTER_MEASUREMENT_UNITS = [
  { code: "KG", name: "Kilogram", symbol: "kg", type: "weight" },
  { code: "GM", name: "Gram", symbol: "g", type: "weight" },
  { code: "LTR", name: "Liter", symbol: "L", type: "volume" },
  { code: "ML", name: "Milliliter", symbol: "ml", type: "volume" },
  { code: "PCS", name: "Pieces", symbol: "pcs", type: "count" },
  { code: "BAG", name: "Bag / Sack", symbol: "bag", type: "packaging" },
  { code: "BALE", name: "Bale", symbol: "bale", type: "packaging" },
  { code: "VIAL", name: "Vial", symbol: "vial", type: "medical" },
  { code: "DOSE", name: "Dose", symbol: "dose", type: "medical" },
] as const;

export const MASTER_DATA = {
  breeds: MASTER_BREEDS,
  units: MASTER_MEASUREMENT_UNITS,
  cattleStatuses: CATTLE_STATUSES,
  cattleStatusLabels: CATTLE_STATUS_LABELS,
  loanStatusLabels: LOAN_STATUS_LABELS,
  costTypes: COST_TYPES,
  costEntryClasses: COST_ENTRY_CLASSES,
  inventoryCategories: INVENTORY_CATEGORIES,
  partnerTypes: PARTNER_TYPES,
  partnerTxnTypes: PARTNER_TXN_TYPES,
  roughageTypes: ROUGHAGE_TYPES,
  depreciationMethods: DEPRECIATION_METHODS,
  fixedExpenseCategories: FIXED_EXPENSE_CATEGORIES,
  variableExpenseCategories: VARIABLE_EXPENSE_CATEGORIES,
  currency: CURRENCY,
  healthEventTypes: HEALTH_EVENT_TYPES,
  vaccines: DLS_VACCINE_SCHEDULE,
  defaults: {
    ...FARM_DEFAULTS,
    dewormingIntervalDays: DEFAULT_DEWORMING_INTERVAL_DAYS,
    quarantineDays: DEFAULT_QUARANTINE_DAYS,
    fiscalYearStartMonth: DEFAULT_FISCAL_YEAR_START_MONTH,
  },
  roles: USER_ROLES,
  permissions: PERMISSIONS,
  rolePermissions: ROLE_PERMISSIONS,
  roleHierarchy: ROLE_HIERARCHY,
  routes: ROUTES,
  cacheTags: CACHE_TAGS,
} as const;

export type MasterData = typeof MASTER_DATA;
