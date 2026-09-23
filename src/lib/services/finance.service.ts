import type { SupabaseClient } from "@supabase/supabase-js";
import { FinancialLockError } from "@/lib/errors";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import type { CashBalanceSummary } from "@/types/domain";

export class FinanceDomainService {
  /**
   * Asserts that a target transaction date does not violate the business financial lock.
   * Throws FinancialLockError if locked.
   */
  public static async assertNotInLockedPeriod(
    supabase: SupabaseClient,
    businessId: string,
    targetDate: string
  ): Promise<void> {
    const { data } = await supabase
      .from("businesses")
      .select("financial_locked_until")
      .eq("id", businessId)
      .maybeSingle();

    const lockDate = (data as { financial_locked_until?: string | null })?.financial_locked_until;
    if (lockDate && targetDate <= lockDate) {
      throw new FinancialLockError(lockDate);
    }
  }

  /**
   * Computes authoritative live cash position across all business ledgers
   */
  public static async calculateCashPosition(
    supabase: SupabaseClient,
    businessId: string
  ): Promise<CashBalanceSummary> {
    return getCashBalance(supabase, businessId);
  }
}
