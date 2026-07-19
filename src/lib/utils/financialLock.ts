import type { ServerClient } from "@/lib/supabase/server";

/**
 * Checks if a specific date falls within a locked financial period.
 * Returns an error message if locked, or null if allowed.
 */
export async function checkFinancialLock(
  supabase: ServerClient,
  businessId: string,
  targetDate: string
): Promise<string | null> {
  try {
    const { data: lock } = await supabase
      .from("financial_locks")
      .select("locked_until")
      .eq("business_id", businessId)
      .gte("locked_until", targetDate)
      .order("locked_until", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lock) {
      return `Cannot modify records on or before ${lock.locked_until}. The financial period is locked due to profit distribution.`;
    }
  } catch (err) {
    // If the table doesn't exist yet (migration not run), silently allow.
    console.warn("Financial lock check skipped:", err);
  }

  return null;
}
