"use server";

import { createClient } from "@/lib/supabase/server";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { getAccountingData } from "@/lib/accounting/engine";
import { cashStatement, type CashCategory, type CashRow } from "@/lib/accounting/cash-ledger";

export type TxnCategory = CashCategory;
export type TxnRow = CashRow;

export type StatementResult = {
  businessName: string;
  openingBalance: number;
  transactions: TxnRow[];
};

/**
 * The cash statement: the rows of THE cash ledger (the one the homepage and the balance sheet
 * add up), so its closing balance is always the cash shown everywhere else. It used to query and
 * add the tables on its own, missing vet fees, supplier dues and deleted partner entries.
 */
export async function getStatementData(from?: string, to?: string): Promise<StatementResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.FINANCE_VIEW);
  if (permissionDenied) throw new Error(permissionDenied);
  const supabase = await createClient();
  const acc = await getAccountingData(supabase);
  const { openingBalance, transactions } = cashStatement(acc.cashLedger, acc.openingCash, from, to);
  return { businessName: acc.businessName || "Farm", openingBalance, transactions };
}
