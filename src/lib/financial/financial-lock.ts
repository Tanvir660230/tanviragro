import type { SupabaseClient } from "@supabase/supabase-js";
import { PeriodClosedError } from "./errors";

export interface FinancialLockRecord {
  id: string;
  business_id: string;
  lock_date: string;
  notes?: string | null;
  created_at: string;
}

export interface LockValidationResult {
  isLocked: boolean;
  lockDate?: string;
  errorMessage?: string;
}

/**
 * Pure helper to verify whether a date falls on or before an active lock date
 */
export function isDateLocked(targetDate: string, lockedUntilDate: string | null | undefined): boolean {
  if (!lockedUntilDate) return false;
  const target = targetDate.slice(0, 10);
  const lock = lockedUntilDate.slice(0, 10);
  return target <= lock;
}

/**
 * Evaluates whether a transaction is blocked by an active financial period lock.
 */
export function validateFinancialLockDate(
  targetDate: string,
  lockedUntilDate: string | null | undefined,
  entityName = "transaction"
): LockValidationResult {
  if (isDateLocked(targetDate, lockedUntilDate)) {
    const lockDateFormatted = (lockedUntilDate || "").slice(0, 10);
    const targetDateFormatted = targetDate.slice(0, 10);
    return {
      isLocked: true,
      lockDate: lockDateFormatted,
      errorMessage: `Cannot modify ${entityName} dated ${targetDateFormatted}. The accounting period is closed and locked up to ${lockDateFormatted}.`,
    };
  }
  return {
    isLocked: false,
  };
}

/**
 * Checks whether a given transaction date falls within a closed accounting period in the database.
 * Throws `PeriodClosedError` if throwOnError is true, or returns error message.
 */
export async function verifyFinancialLock(
  supabase: SupabaseClient<any>,
  businessId: string,
  transactionDate: string,
  options: { throwOnError?: boolean; entityName?: string } = {}
): Promise<string | null> {
  if (!businessId || !transactionDate) return null;

  const dateStr = transactionDate.slice(0, 10);

  try {
    const { data: lock } = await supabase
      .from("financial_locks")
      .select("lock_date")
      .eq("business_id", businessId)
      .gte("lock_date", dateStr)
      .order("lock_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lock?.lock_date) {
      const result = validateFinancialLockDate(dateStr, lock.lock_date, options.entityName);
      if (result.isLocked) {
        if (options.throwOnError) {
          throw new PeriodClosedError(lock.lock_date, dateStr);
        }
        return result.errorMessage || `Financial period is closed up to ${lock.lock_date}.`;
      }
    }
  } catch (err) {
    if (err instanceof PeriodClosedError) throw err;
    console.warn("Financial lock verification warning:", err);
  }

  return null;
}