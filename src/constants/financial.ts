import type { CostType, CostEntryClass, InventoryCategory, PartnerType, PartnerTransactionType } from "@/types/database";

export const COST_TYPES: readonly CostType[] = ["fixed", "variable"] as const;
export const COST_ENTRY_CLASSES: readonly CostEntryClass[] = ["expense", "asset"] as const;

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
  "feed",
  "medicine",
  "equipment",
  "roughage",
  "other",
] as const;

export const PARTNER_TYPES: readonly PartnerType[] = ["capital", "labor", "hybrid"] as const;

export const PARTNER_TXN_TYPES: readonly PartnerTransactionType[] = [
  "investment",
  "withdrawal",
  "profit",
  "loss_allocation",
] as const;

export const ROUGHAGE_TYPES = ["straw", "hay", "silage", "grass"] as const;
export type RoughageType = typeof ROUGHAGE_TYPES[number];

export const DEPRECIATION_METHODS = ["straight_line", "declining_balance"] as const;
export type DepreciationMethod = typeof DEPRECIATION_METHODS[number];

export const FIXED_EXPENSE_CATEGORIES = [
  "Labor & Salary",
  "Farm Rent & Land Lease",
  "Electricity & Utilities",
  "Maintenance & Infrastructure",
  "Administrative & Legal",
  "Security & Logistics",
  "Other Fixed Overhead",
] as const;

export const VARIABLE_EXPENSE_CATEGORIES = [
  "Cattle Purchase Transport",
  "Haat / Hasil Tax",
  "Veterinary & Medication",
  "Feed & Supplements",
  "Processing & Hauling",
  "Consumable Supplies",
  "Other Variable Expense",
] as const;

export const CURRENCY = {
  CODE: "BDT",
  SYMBOL: "৳",
  LOCALE_EN: "en-BD",
  LOCALE_BN: "bn-BD",
} as const;

export const DEFAULT_FISCAL_YEAR_START_MONTH = 7; // July in Bangladesh
