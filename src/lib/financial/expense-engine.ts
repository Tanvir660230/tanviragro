import { mapExpenseCategoryToAccount } from "./chart-of-accounts";

export interface ExpenseRecord {
  id: string;
  businessId: string;
  cattleId?: string | null;
  type: "fixed" | "variable";
  entryClass: "expense" | "asset";
  category: string;
  amount: number;
  recordedAt: string;
  description?: string | null;
}

export class ExpenseEngine {
  /**
   * Categorizes and maps raw cost entries to their standardized COA ledger accounts
   */
  public static categorizeExpense(entry: ExpenseRecord) {
    const isAsset = entry.entryClass === "asset";
    const account = isAsset
      ? { code: "1500", name: "Property, Plant & Equipment", section: "assets" }
      : mapExpenseCategoryToAccount(entry.category);

    return {
      ...entry,
      accountCode: account.code,
      accountName: account.name,
      accountSection: account.section,
    };
  }

  /**
   * Aggregates expenses by category and operational type
   */
  public static aggregateExpenses(entries: ExpenseRecord[]) {
    const categorized = entries.map((e) => this.categorizeExpense(e));
    const operatingExpenses = categorized.filter((e) => e.entryClass === "expense");
    const capitalExpenses = categorized.filter((e) => e.entryClass === "asset");

    const totalOperating = operatingExpenses.reduce((s, e) => s + e.amount, 0);
    const totalCapital = capitalExpenses.reduce((s, e) => s + e.amount, 0);

    const byCategory: Record<string, { count: number; total: number; accountCode: string }> = {};

    for (const e of operatingExpenses) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { count: 0, total: 0, accountCode: e.accountCode };
      }
      byCategory[e.category].count += 1;
      byCategory[e.category].total += e.amount;
    }

    return {
      totalOperating: Math.round(totalOperating * 100) / 100,
      totalCapital: Math.round(totalCapital * 100) / 100,
      totalCombined: Math.round((totalOperating + totalCapital) * 100) / 100,
      byCategory,
      count: entries.length,
    };
  }
}