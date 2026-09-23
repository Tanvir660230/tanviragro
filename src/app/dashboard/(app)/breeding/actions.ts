/**
 * Breeding Module — Server Actions
 *
 * This file re-exports all actions from the canonical breeding-actions.ts
 * so that every sub-page within /dashboard/breeding/ imports from one place.
 * It also adds module-level helper actions for reminder dismissal.
 */
"use server";

export {
  recordHeatAction,
  recordBreedingAttemptAction,
  recordPregnancyDiagnosisAction,
  recordCalvingAndRegisterOffspringAction,
  recordSemenStockAction,
  recordWeaningAction,
  evaluateInbreedingRiskAction,
} from "@/app/dashboard/(app)/cattle/breeding-actions";

// ── Dismiss reproduction reminder ─────────────────────────────────────────────
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";

export async function dismissReminderAction(reminderId: string): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);

    const { error } = await (supabase as any)
      .from("reproduction_reminders")
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("business_id", ctx.businessId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/breeding");
    revalidatePath("/dashboard/breeding/animals");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to dismiss reminder" };
  }
}
