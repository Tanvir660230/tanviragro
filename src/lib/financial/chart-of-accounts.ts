import type { AccountDefinition, AccountSection, NormalBalance } from "./types";

export const CHART_OF_ACCOUNTS: Record<string, AccountDefinition> = {
  // ── 1000s: Current Assets ─────────────────────────────────────────
  "1010": {
    code: "1010",
    name: "Cash and Bank",
    section: "assets",
    normalBalance: "debit",
    description: "Physical cash on hand and operational bank account balances",
    isSystem: true,
  },
  "1200": {
    code: "1200",
    name: "Livestock Inventory",
    section: "assets",
    normalBalance: "debit",
    description: "Capitalized cost basis of active cattle herd",
    isSystem: true,
  },
  "1300": {
    code: "1300",
    name: "Feed & Supplies Inventory",
    section: "assets",
    normalBalance: "debit",
    description: "Feed, roughage, medicine, and operational supplies inventory",
    isSystem: true,
  },

  // ── 1500s: Non-Current / Fixed Assets ─────────────────────────────
  "1500": {
    code: "1500",
    name: "Property, Plant & Equipment",
    section: "assets",
    normalBalance: "debit",
    description: "Sheds, land improvements, machinery, solar, and long-term farm equipment",
    isSystem: true,
  },
  "1590": {
    code: "1590",
    name: "Accumulated Depreciation",
    section: "assets",
    normalBalance: "credit", // Contra-asset
    description: "Cumulative depreciation recognized on fixed assets",
    isSystem: true,
  },

  // ── 2000s: Liabilities ────────────────────────────────────────────
  "2010": {
    code: "2010",
    name: "Accounts Payable & Vendor Credit",
    section: "liabilities",
    normalBalance: "credit",
    description: "Short-term trade liabilities and unpaid vendor invoices",
    isSystem: true,
  },
  "2100": {
    code: "2100",
    name: "Bank & Commercial Loans",
    section: "liabilities",
    normalBalance: "credit",
    description: "Outstanding principal balances on formal loans",
    isSystem: true,
  },
  "2110": {
    code: "2110",
    name: "Accrued Interest Payable",
    section: "liabilities",
    normalBalance: "credit",
    description: "Accrued and unpaid interest liabilities",
    isSystem: true,
  },
  "2200": {
    code: "2200",
    name: "Other Informal Borrowings & Liabilities",
    section: "liabilities",
    normalBalance: "credit",
    description: "Informal borrowings and temporary farm obligations",
    isSystem: true,
  },

  // ── 3000s: Equity ─────────────────────────────────────────────────
  "3010": {
    code: "3010",
    name: "Partner Capital",
    section: "equity",
    normalBalance: "credit",
    description: "Total invested capital contributions from partners and owners",
    isSystem: true,
  },
  "3020": {
    code: "3020",
    name: "Partner Drawings & Distributions",
    section: "equity",
    normalBalance: "debit", // Contra-equity
    description: "Capital withdrawals and profit distributions paid out to partners",
    isSystem: true,
  },
  "3100": {
    code: "3100",
    name: "Retained Earnings",
    section: "equity",
    normalBalance: "credit",
    description: "Accumulated historical profits and losses retained in the business",
    isSystem: true,
  },
  "3200": {
    code: "3200",
    name: "Current Period Profit / Loss",
    section: "equity",
    normalBalance: "credit",
    description: "Net earnings/loss generated during the current operational period",
    isSystem: true,
  },

  // ── 4000s: Revenue ────────────────────────────────────────────────
  "4010": {
    code: "4010",
    name: "Cattle Sales Revenue",
    section: "revenue",
    normalBalance: "credit",
    description: "Gross proceeds realized from cattle and livestock sales",
    isSystem: true,
  },
  "4020": {
    code: "4020",
    name: "Feed & Byproduct Sales",
    section: "revenue",
    normalBalance: "credit",
    description: "Revenue from milk, manure/fertilizer, or feed resale",
    isSystem: true,
  },
  "4900": {
    code: "4900",
    name: "Other Farm Income",
    section: "revenue",
    normalBalance: "credit",
    description: "Miscellaneous operational income, asset disposal gains, and subsidies",
    isSystem: true,
  },

  // ── 5000s: Cost of Goods Sold (COGS) ──────────────────────────────
  "5010": {
    code: "5010",
    name: "Cost of Cattle Sold (COGS)",
    section: "expenses",
    normalBalance: "debit",
    description: "Original purchase cost and direct attributable basis of sold cattle",
    isSystem: true,
  },
  "5020": {
    code: "5020",
    name: "Direct Cattle Attributable Costs",
    section: "expenses",
    normalBalance: "debit",
    description: "Direct costs specifically assigned to cattle lots",
    isSystem: true,
  },
  "5030": {
    code: "5030",
    name: "Feed & Nutrition Expense",
    section: "expenses",
    normalBalance: "debit",
    description: "Feed, roughage, and concentrate consumption costs",
    isSystem: true,
  },

  // ── 6000s: Operating Expenses ─────────────────────────────────────
  "6100": {
    code: "6100",
    name: "Veterinary & Health Expenses",
    section: "expenses",
    normalBalance: "debit",
    description: "Medications, vaccines, vet consultations, and deworming treatments",
    isSystem: true,
  },
  "6200": {
    code: "6200",
    name: "Labor & Wages",
    section: "expenses",
    normalBalance: "debit",
    description: "Farm worker salaries, overtime, bonuses, and food allowances",
    isSystem: true,
  },
  "6300": {
    code: "6300",
    name: "Utilities & Energy",
    section: "expenses",
    normalBalance: "debit",
    description: "Electricity, fuel, generator diesel, water, and gas",
    isSystem: true,
  },
  "6400": {
    code: "6400",
    name: "Rent & Land Lease",
    section: "expenses",
    normalBalance: "debit",
    description: "Land, pasture, shed lease, and equipment rental payments",
    isSystem: true,
  },
  "6500": {
    code: "6500",
    name: "Depreciation Expense",
    section: "expenses",
    normalBalance: "debit",
    description: "Periodic non-cash write-down of fixed assets",
    isSystem: true,
  },
  "6600": {
    code: "6600",
    name: "General & Administrative Expenses",
    section: "expenses",
    normalBalance: "debit",
    description: "Office supplies, license fees, software, travel, and miscellaneous costs",
    isSystem: true,
  },
  "6700": {
    code: "6700",
    name: "Transport & Logistics",
    section: "expenses",
    normalBalance: "debit",
    description: "Cattle freight, feed trucking, hauling, and delivery charges",
    isSystem: true,
  },
  "6800": {
    code: "6800",
    name: "Repairs & Maintenance",
    section: "expenses",
    normalBalance: "debit",
    description: "Shed maintenance, fence repair, plumbing, and tool repairs",
    isSystem: true,
  },

  // ── 7000s & 8000s: Financing & Extraordinary ──────────────────────
  "7010": {
    code: "7010",
    name: "Loan Interest Expense",
    section: "expenses",
    normalBalance: "debit",
    description: "Interest paid or accrued on commercial borrowings and loans",
    isSystem: true,
  },
  "8010": {
    code: "8010",
    name: "Livestock Mortality & Casualty Loss",
    section: "expenses",
    normalBalance: "debit",
    description: "Non-cash write-off of deceased cattle basis",
    isSystem: true,
  },
  "4040": {
    code: "4040",
    name: "Biological Asset Fair Value Gain (IAS 41)",
    section: "revenue",
    normalBalance: "credit",
    description: "Unrealized gain recognized from biological asset fair value changes and animal growth",
    isSystem: true,
  },
  "6150": {
    code: "6150",
    name: "Breeding & Artificial Insemination",
    section: "expenses",
    normalBalance: "debit",
    description: "Semen straws, inseminator technician fees, and fertility synchronization hormones",
    isSystem: true,
  },
  "6160": {
    code: "6160",
    name: "Vaccination & Preventive Immunization",
    section: "expenses",
    normalBalance: "debit",
    description: "FMD, Anthrax, Blackleg, and LSR vaccinations",
    isSystem: true,
  },
  "8020": {
    code: "8020",
    name: "Biological Asset Fair Value Loss (IAS 41)",
    section: "expenses",
    normalBalance: "debit",
    description: "Unrealized devaluation recognized on biological assets due to market fluctuations",
    isSystem: true,
  },

};

export function getAccountByCode(code: string): AccountDefinition {
  const acc = CHART_OF_ACCOUNTS[code];
  if (!acc) {
    return {
      code,
      name: `Account ${code}`,
      section: "expenses",
      normalBalance: "debit",
      description: "Auto-generated account line",
    };
  }
  return acc;
}

export function mapExpenseCategoryToAccount(category: string): AccountDefinition {
  const c = (category || "").toLowerCase();
  if (/vet|med|vacc|health|drug|dew|doctor|treatment/.test(c)) return CHART_OF_ACCOUNTS["6100"];
  if (/lab|wage|salary|worker|staff|employ|kormi/.test(c)) return CHART_OF_ACCOUNTS["6200"];
  if (/elect|water|gas|util|fuel|power|diesel|current/.test(c)) return CHART_OF_ACCOUNTS["6300"];
  if (/rent|lease|bhara/.test(c)) return CHART_OF_ACCOUNTS["6400"];
  if (/deprec/.test(c)) return CHART_OF_ACCOUNTS["6500"];
  if (/transport|deliver|freight|shipping|truck|gari/.test(c)) return CHART_OF_ACCOUNTS["6700"];
  if (/repair|maint|fix|meramot/.test(c)) return CHART_OF_ACCOUNTS["6800"];
  if (/feed|ghas|khail|bhusi|silage|fodder/.test(c)) return CHART_OF_ACCOUNTS["5030"];
  return CHART_OF_ACCOUNTS["6600"]; // General Expense
}