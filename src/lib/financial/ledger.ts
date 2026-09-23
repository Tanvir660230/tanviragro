import type { JournalEntry } from "./types";
import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";

export interface LedgerAccountSummary {
  accountCode: string;
  accountName: string;
  section: "assets" | "liabilities" | "equity" | "revenue" | "expenses";
  normalBalance: "debit" | "credit";
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  entriesCount: number;
}

export interface GeneralLedger {
  businessId: string;
  accounts: Record<string, LedgerAccountSummary>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  generatedAt: string;
}

export class GeneralLedgerEngine {
  /**
   * Compiles an array of double-entry Journal Entries into a consolidated General Ledger
   */
  public static compileLedger(businessId: string, journalEntries: JournalEntry[]): GeneralLedger {
    const accounts: Record<string, LedgerAccountSummary> = {};

    // Initialize all standard accounts from COA
    for (const [code, def] of Object.entries(CHART_OF_ACCOUNTS)) {
      accounts[code] = {
        accountCode: code,
        accountName: def.name,
        section: def.section,
        normalBalance: def.normalBalance,
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
        entriesCount: 0,
      };
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    for (const entry of journalEntries) {
      if (!entry.isBalanced) continue;

      for (const line of entry.lines) {
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        grandTotalDebit += debit;
        grandTotalCredit += credit;

        let acc = accounts[line.accountCode];
        if (!acc) {
          acc = {
            accountCode: line.accountCode,
            accountName: line.accountName || `Account ${line.accountCode}`,
            section: "expenses",
            normalBalance: "debit",
            totalDebit: 0,
            totalCredit: 0,
            netBalance: 0,
            entriesCount: 0,
          };
          accounts[line.accountCode] = acc;
        }

        acc.totalDebit += debit;
        acc.totalCredit += credit;
        acc.entriesCount += 1;

        if (acc.normalBalance === "debit") {
          acc.netBalance = acc.totalDebit - acc.totalCredit;
        } else {
          acc.netBalance = acc.totalCredit - acc.totalDebit;
        }
      }
    }

    grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
    grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;
    const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

    return {
      businessId,
      accounts,
      totalDebits: grandTotalDebit,
      totalCredits: grandTotalCredit,
      isBalanced,
      generatedAt: new Date().toISOString(),
    };
  }
}