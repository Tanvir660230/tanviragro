/**
 * Expense categories: rules shared by the accounting engine, server actions and pages
 * (pure, no I/O). Categories are data (table expense_categories, managed in the app); the
 * only fixed thing is the small set of KINDS, because a kind decides the account.
 * Renaming a category never moves its expenses to another account.
 */
import type { ExpenseKind } from "@/types/database";

export const EXPENSE_KIND_ACCOUNT: Record<ExpenseKind, { code: string; name: string }> = {
  utility:    { code: "6300", name: "Utilities" },
  labor:      { code: "6200", name: "Labor & Wages" },
  rent:       { code: "6400", name: "Rent & Lease" },
  transport:  { code: "6700", name: "Transport" },
  repair:     { code: "6800", name: "Repairs & Maintenance" },
  veterinary: { code: "6100", name: "Veterinary & Medical" },
  general:    { code: "6600", name: "General Expenses" },
};

export const EXPENSE_KINDS = Object.keys(EXPENSE_KIND_ACCOUNT) as ExpenseKind[];

/** Legacy free-text category → account (entries created before categories existed). */
export function accountForLegacyCategory(category: string): { code: string; name: string } {
  const c = category.toLowerCase();
  // feed-related costs paid in cash (e.g. straw cutting) are feed, not general expenses
  if (/feed|fodder|forage|grass|straw|khor|ghash|খড়|ঘাস|খাদ্য/.test(c)) return { code: "5200", name: "Feed Expenses" };
  if (/vet|med|vacc|health|drug|dew/.test(c)) return EXPENSE_KIND_ACCOUNT.veterinary;
  if (/lab|wage|salary|worker|staff|employ/.test(c)) return EXPENSE_KIND_ACCOUNT.labor;
  if (/elect|water|gas|util|fuel|power|wifi|internet|phone|telephone/.test(c)) return EXPENSE_KIND_ACCOUNT.utility;
  if (/rent|lease/.test(c)) return EXPENSE_KIND_ACCOUNT.rent;
  if (/deprec/.test(c)) return { code: "6500", name: "Depreciation" };
  if (/transport|deliver|freight|shipping/.test(c)) return EXPENSE_KIND_ACCOUNT.transport;
  if (/repair|maint|fix/.test(c)) return EXPENSE_KIND_ACCOUNT.repair;
  return EXPENSE_KIND_ACCOUNT.general;
}

/** Account of a cost entry: its category's kind when linked, else the legacy text rule. */
export function accountForCostEntry(entry: { category: string; kind?: ExpenseKind | null }): { code: string; name: string } {
  return entry.kind ? EXPENSE_KIND_ACCOUNT[entry.kind] : accountForLegacyCategory(entry.category);
}

/** Validation message for a category name, or null when valid. */
export function categoryNameError(name: string, existing: { id: string; name: string }[], selfId?: string): string | null {
  const n = name.trim();
  if (!n) return "Name is required";
  if (n.length > 80) return "Name must be at most 80 characters";
  const key = n.toLowerCase();
  if (existing.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === key)) return `"${n}" already exists`;
  return null;
}

export type ExpenseRow = { amount: number | string; recorded_at: string; category_id: string | null };

/**
 * Monthly totals per category for the last `months` months ending at `asOf` (YYYY-MM-DD).
 * Rows without a category are grouped under the key "uncategorised".
 */
export function monthlyExpenseSummary(
  rows: ExpenseRow[],
  asOf: string,
  months = 12
): { months: string[]; byCategory: Record<string, Record<string, number>>; totals: Record<string, number> } {
  const end = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - i);
    keys.push(d.toISOString().slice(0, 7));
  }
  const inRange = new Set(keys);
  const byCategory: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const m = r.recorded_at.slice(0, 7);
    if (!inRange.has(m)) continue;
    const cat = r.category_id ?? "uncategorised";
    const amt = Number(r.amount) || 0;
    (byCategory[cat] ??= {})[m] = (byCategory[cat][m] ?? 0) + amt;
    totals[m] += amt;
  }
  return { months: keys, byCategory, totals };
}

/** Allowed bill attachments. */
export const BILL_MAX_BYTES = 5 * 1024 * 1024;
export const BILL_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
