"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { validateDate, validatePositiveNumber } from "@/lib/validate";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type CostFormState = { error?: string; success?: boolean } | undefined;

export async function createCostEntry(
  _prevState: CostFormState,
  formData: FormData
): Promise<CostFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "No active business found" };

  const lockError = await checkFinancialLock(supabase, businessId, recorded_at);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("cost_entries").insert({
    business_id: businessId,
    type: type as "fixed" | "variable",
    entry_class: entryClass as "expense" | "asset",
    category,
    amount,
    recorded_at,
    description,
  });

  if (error) return { error: "Failed to save cost entry" };

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: entry } = await supabase
    .from("cost_entries")
    .select("business_id, recorded_at")
    .eq("id", id)
    .maybeSingle();
  if (!entry || entry.business_id !== businessId) return { error: "Unauthorized" };

  const lockDate = updates.recorded_at ?? (entry as { recorded_at: string }).recorded_at;
  const lockErr = await checkFinancialLock(supabase, businessId, lockDate);
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
}

export async function deleteCostEntry(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: entry } = await supabase
    .from("cost_entries")
    .select("business_id, recorded_at")
    .eq("id", id)
    .maybeSingle();
  if (!entry || entry.business_id !== businessId) return { error: "Unauthorized" };

  const delLockErr = await checkFinancialLock(supabase, businessId, (entry as { recorded_at: string }).recorded_at);
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
}

export type BulkCostItem = {
  mode: "expense-fixed" | "expense-variable" | "asset";
  category: string;
  amount: number;
  recordedAt: string;
  description: string;
};

export async function submitBulkCosts(items: BulkCostItem[]) {
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!items || items.length === 0) return { error: "No items added" };

  // Collect records to insert
  const costEntries = [];

  for (const item of items) {
    if (!item.category) return { error: "Category is required for all items" };
    if (!item.amount || item.amount <= 0) return { error: "Amount must be greater than 0 for all items" };
    if (!item.recordedAt) return { error: "Date is required for all items" };

    const lockError = await checkFinancialLock(supabase, businessId, item.recordedAt);
    if (lockError) return { error: lockError };

    const costType = item.mode === "asset" ? "fixed" : item.mode === "expense-fixed" ? "fixed" : "variable";
    const entryClass = item.mode === "asset" ? "asset" : "expense";

    costEntries.push({
      business_id: businessId,
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
}
