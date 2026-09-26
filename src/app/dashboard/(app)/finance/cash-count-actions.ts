"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { validateDate } from "@/lib/validate";
import { getAccountingData } from "@/lib/accounting/engine";
import { cashOnDate } from "@/lib/accounting/cash-ledger";

export type CashCountState = { error?: string; success?: boolean } | undefined;

const NOT_READY = "টাকা গোনার হিসাব রাখা যাবে database আপডেটের পরে (migration 20260927120000)।";
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find the table/i.test(e.message ?? ""));

/** Write down a cash count; the books' figure for that day is kept with it for the record. */
export async function saveCashCount(_prev: CashCountState, formData: FormData): Promise<CashCountState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    const countedOn = String(formData.get("counted_on") ?? "");
    const amount = Number(formData.get("amount"));
    const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
    const dateErr = validateDate(countedOn, "Date");
    if (dateErr) return { error: dateErr };
    if (!Number.isFinite(amount) || amount < 0) return { error: "গোনা টাকার অঙ্ক শূন্য বা তার বেশি দিন" };

    const acc = await getAccountingData(supabase);
    const expected = Math.round(cashOnDate(acc.cashLedger, acc.openingCash, countedOn) * 100) / 100;

    const { error } = await supabase.from("cash_counts").insert({ business_id: ctx.businessId, counted_on: countedOn, amount, expected, note });
    if (error) return { error: missingTable(error) ? NOT_READY : "গোনা টাকা সেভ হয়নি" };
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "গোনা টাকা সেভ হয়নি" };
  }
}

/** Remove a count written by mistake (kept, marked deleted). */
export async function deleteCashCount(id: string): Promise<CashCountState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_DELETE);
    const { error } = await supabase.from("cash_counts").update({ deleted_at: new Date().toISOString() })
      .eq("id", id).eq("business_id", ctx.businessId);
    if (error) return { error: "মুছা যায়নি" };
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "মুছা যায়নি" };
  }
}
