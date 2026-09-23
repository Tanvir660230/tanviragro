"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { validateDate, validatePositiveNumber } from "@/lib/validate";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { FinancialEventBus } from "@/lib/financial/events";

export type CostFormState = { error?: string; success?: boolean } | undefined;

export async function createCostEntry(
  _prevState: CostFormState,
  formData: FormData
): Promise<CostFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    const type = formData.get("type") as string;
    const entryClass = (formData.get("entry_class") as string) || "expense";
    const category = (formData.get("category") as string)?.trim();
    const amount = parseFloat(formData.get("amount") as string);
    const recorded_at = formData.get("recorded_at") as string;
    const description = (formData.get("description") as string)?.trim() || null;

    if (!type || !["fixed", "variable"].includes(type))
      return { error: "Select a cost type" };
    if (!["expense", "asset"].includes(entryClass))
      return { error: "Invalid entry class" };
    if (!category) return { error: "Category is required" };
    const amountErr = validatePositiveNumber(amount, "Amount");
    if (amountErr) return { error: amountErr };
    const dateErr = validateDate(recorded_at, "Date");
    if (dateErr) return { error: dateErr };

    const lockError = await verifyFinancialLock(supabase, ctx.businessId, recorded_at);
    if (lockError) return { error: lockError };

    const { data: inserted, error } = await supabase
      .from("cost_entries")
      .insert({
        business_id: ctx.businessId,
        type: type as "fixed" | "variable",
        entry_class: entryClass as "expense" | "asset",
        category,
        amount,
        recorded_at,
        description,
      })
      .select("id")
      .single();

    if (error) return { error: "Failed to save cost entry" };

    await FinancialEventBus.publish(
      "ExpenseCreated",
      ctx.businessId,
      {
        costId: inserted?.id,
        amount,
        category,
        entryClass,
        recordedAt: recorded_at,
      },
      ctx.user.id
    );

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to create cost entry" };
  }
}

export async function updateCostEntry(
  id: string,
  updates: {
    type?: "fixed" | "variable";
    entry_class?: "expense" | "asset";
    category?: string;
    amount?: number;
    recorded_at?: string;
    description?: string | null;
  }
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_EDIT);

    const entry = await assertResourceOwnership<{ business_id: string; recorded_at: string }>(
      supabase,
      "cost_entries",
      id,
      ctx.businessId
    );

    const lockDate = updates.recorded_at ?? entry.recorded_at;
    const lockErr = await verifyFinancialLock(supabase, ctx.businessId, lockDate);
    if (lockErr) return { error: lockErr };

    if (updates.amount !== undefined) {
      if (!isFinite(updates.amount) || updates.amount <= 0)
        return { error: "Amount must be a positive number" };
    }
    if (updates.recorded_at) {
      const dateErr = validateDate(updates.recorded_at, "Date");
      if (dateErr) return { error: dateErr };
    }

    const { error } = await supabase
      .from("cost_entries")
      .update(updates)
      .eq("id", id);
    if (error) return { error: "Failed to update entry" };

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update cost entry" };
  }
}

export async function deleteCostEntry(
  id: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_DELETE);

    const entry = await assertResourceOwnership<{ business_id: string; recorded_at: string }>(
      supabase,
      "cost_entries",
      id,
      ctx.businessId
    );

    const delLockErr = await verifyFinancialLock(supabase, ctx.businessId, entry.recorded_at);
    if (delLockErr) return { error: delLockErr };

    const { error } = await supabase
      .from("cost_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: "Failed to delete entry" };

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete cost entry" };
  }
}

export type BulkCostItem = {
  mode: "expense-fixed" | "expense-variable" | "asset";
  category: string;
  amount: number;
  recordedAt: string;
  description: string;
};

export async function submitBulkCosts(items: BulkCostItem[]) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    if (!items || items.length === 0) return { error: "No items added" };

    const costEntries = [];

    for (const item of items) {
      if (!item.category) return { error: "Category is required for all items" };
      if (!item.amount || item.amount <= 0) return { error: "Amount must be greater than 0 for all items" };
      if (!item.recordedAt) return { error: "Date is required for all items" };

      const lockError = await verifyFinancialLock(supabase, ctx.businessId, item.recordedAt);
      if (lockError) return { error: lockError };

      const costType = item.mode === "asset" ? "fixed" : item.mode === "expense-fixed" ? "fixed" : "variable";
      const entryClass = item.mode === "asset" ? "asset" : "expense";

      costEntries.push({
        business_id: ctx.businessId,
        type: costType as "fixed" | "variable",
        entry_class: entryClass as "expense" | "asset",
        category: item.category,
        amount: item.amount,
        recorded_at: item.recordedAt,
        description: item.description || null,
      });
    }

    const { error } = await supabase.from("cost_entries").insert(costEntries);
    if (error) return { error: "Failed to save bulk cost entries" };

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to save bulk costs" };
  }
}