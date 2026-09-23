import type { UserRole } from "@/types/database";

export const USER_ROLES: readonly UserRole[] = ["owner", "manager", "worker"] as const;

export type ExtendedUserRole = UserRole | "admin" | "viewer";

export const ROLE_HIERARCHY: Record<ExtendedUserRole, number> = {
  owner:        100,
  admin:        80,
  manager:      60,
  veterinarian: 50,
  staff:        45,
  worker:       40,
  viewer:       20,
};

export const ROLE_BADGE_STYLE: Record<string, string> = {
  owner:        "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border border-purple-300 dark:border-purple-800",
  admin:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
  manager:      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border border-blue-300 dark:border-blue-800",
  veterinarian: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 border border-teal-300 dark:border-teal-800",
  staff:        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800",
  worker:       "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800",
  viewer:       "bg-muted text-muted-foreground border border-border",
};

export const PERMISSIONS = {
  // Livestock / Cattle
  CATTLE_VIEW:     "cattle:view",
  CATTLE_CREATE:   "cattle:create",
  CATTLE_EDIT:     "cattle:edit",
  CATTLE_DELETE:   "cattle:delete",
  CATTLE_SELL:     "cattle:sell",
  CATTLE_EXPORT:   "cattle:export",
  CATTLE_PRINT:    "cattle:print",
  WEIGHT_LOG:      "weight:log",
  HEALTH_VIEW:     "health:view",
  HEALTH_MANAGE:   "health:manage",

  // Inventory & Feed
  INVENTORY_VIEW:     "inventory:view",
  INVENTORY_CREATE:   "inventory:create",
  INVENTORY_EDIT:     "inventory:edit",
  INVENTORY_DELETE:   "inventory:delete",
  INVENTORY_PURCHASE: "inventory:purchase",
  INVENTORY_CONSUME:  "inventory:consume",
  INVENTORY_EXPORT:   "inventory:export",
  FEED_MIX:           "feed:mix",

  // Finance & Accounting
  FINANCE_VIEW:       "finance:view",
  FINANCE_EXPORT:     "finance:export",
  COST_ENTRY_CREATE:  "cost:create",
  COST_ENTRY_EDIT:    "cost:edit",
  COST_ENTRY_DELETE:  "cost:delete",
  FINANCIAL_LOCK:     "finance:lock",
  FINANCIAL_APPROVE:  "finance:approve",
  ACCOUNTING_VIEW:    "accounting:view",
  ACCOUNTING_EXPORT:  "accounting:export",
  ACCOUNTING_CLOSE:   "accounting:close",

  // Loans & Assets
  LOAN_VIEW:          "loan:view",
  LOAN_MANAGE:        "loan:manage",
  LOAN_PAY:           "loan:pay",
  ASSET_VIEW:         "asset:view",
  ASSET_MANAGE:       "asset:manage",

  // Partners & Equity
  PARTNERS_VIEW:      "partners:view",
  PARTNERS_MANAGE:    "partners:manage",
  PARTNERS_DIVIDEND:  "partners:dividend",
  PARTNERS_STATEMENT: "partners:statement",

  // Administration & Team
  SETTINGS_VIEW:      "settings:view",
  SETTINGS_EDIT:      "settings:edit",
  TEAM_VIEW:          "team:view",
  TEAM_MANAGE:        "team:manage",
  AUDIT_LOG_VIEW:     "audit:view",
  BACKUP_MANAGE:      "backup:manage",
  REPORTS_VIEW:       "reports:view",
  REPORTS_EXPORT:     "reports:export",

  // Commerce, Sales & Logistics
  COMMERCE_VIEW:      "commerce:view",
  COMMERCE_MANAGE:    "commerce:manage",
  COMMERCE_APPROVE:   "commerce:approve",
  COMMERCE_TRANSFER:  "commerce:transfer",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Centralized Permission Matrix across all standard ERP roles */
export const ROLE_PERMISSIONS: Record<ExtendedUserRole, readonly Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  veterinarian: [
    PERMISSIONS.CATTLE_VIEW,
    PERMISSIONS.WEIGHT_LOG,
    PERMISSIONS.HEALTH_VIEW,
    PERMISSIONS.HEALTH_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  staff: [
    PERMISSIONS.CATTLE_VIEW,
    PERMISSIONS.WEIGHT_LOG,
    PERMISSIONS.HEALTH_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CONSUME,
    PERMISSIONS.FEED_MIX,
  ],
  manager: [
    PERMISSIONS.CATTLE_VIEW,
    PERMISSIONS.CATTLE_CREATE,
    PERMISSIONS.CATTLE_EDIT,
    PERMISSIONS.CATTLE_SELL,
    PERMISSIONS.CATTLE_EXPORT,
    PERMISSIONS.CATTLE_PRINT,
    PERMISSIONS.WEIGHT_LOG,
    PERMISSIONS.HEALTH_VIEW,
    PERMISSIONS.HEALTH_MANAGE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_PURCHASE,
    PERMISSIONS.INVENTORY_CONSUME,
    PERMISSIONS.INVENTORY_EXPORT,
    PERMISSIONS.FEED_MIX,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_EXPORT,
    PERMISSIONS.COST_ENTRY_CREATE,
    PERMISSIONS.PARTNERS_VIEW,
    PERMISSIONS.PARTNERS_STATEMENT,
    PERMISSIONS.ASSET_VIEW,
    PERMISSIONS.LOAN_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.COMMERCE_VIEW,
    PERMISSIONS.COMMERCE_MANAGE,
    PERMISSIONS.COMMERCE_APPROVE,
    PERMISSIONS.COMMERCE_TRANSFER,
  ],
  worker: [
    PERMISSIONS.CATTLE_VIEW,
    PERMISSIONS.CATTLE_PRINT,
    PERMISSIONS.WEIGHT_LOG,
    PERMISSIONS.HEALTH_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CONSUME,
    PERMISSIONS.FEED_MIX,
  ],
  viewer: [
    PERMISSIONS.CATTLE_VIEW,
    PERMISSIONS.HEALTH_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.PARTNERS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.COMMERCE_VIEW,
  ],
};
