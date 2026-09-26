"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { isTreatmentDuplicate, type TreatmentFee } from "@/lib/expenses/treatment-duplicate";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

async function getOwnerBizId(supabase: TypedClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function restoreCostEntry(id: string): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.SETTINGS_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: entry } = await supabase.from("cost_entries").select("business_id, category, amount, recorded_at, cattle_id, description").eq("id", id).maybeSingle();
  if (!entry || entry.business_id !== bizId) return { error: "Unauthorized" };

  // a vet fee saved twice by the old form: its money is already on the treatment row
  if (entry.category === "Medical/Vet Fee") {
    const { data: rows } = await supabase.from("cattle_treatments")
      .select("cattle_id, vet_fee, additional_medical_cost, treated_at, cattle!inner(business_id, tag_id)").eq("cattle.business_id", bizId);
    const treatments = ((rows ?? []) as unknown as (TreatmentFee & { cattle: { tag_id: string | null } | null })[]).map((t) => ({ ...t, tag: t.cattle?.tag_id ?? null }));
    if (isTreatmentDuplicate(entry, treatments)) return { error: "This vet fee is already counted on its treatment record — restoring it would count the money twice." };
  }

  const { error } = await supabase.from("cost_entries").update({ deleted_at: null }).eq("id", id);
  if (error) return { error: "Failed to restore" };
  // a partner's credit for this expense comes back with it
  await supabase.from("partner_transactions").update({ deleted_at: null }).eq("cost_entry_id", id).not("deleted_at", "is", null);
  revalidatePath("/dashboard/partners");
  revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/settings/trash");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function restoreInventoryItem(id: string): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.SETTINGS_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: item } = await supabase.from("inventory_items").select("business_id").eq("id", id).maybeSingle();
  if (!item || item.business_id !== bizId) return { error: "Unauthorized" };

  const { error } = await supabase.from("inventory_items").update({ deleted_at: null }).eq("id", id);
  if (error) return { error: "Failed to restore" };
  revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/settings/trash");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function restoreWeightLog(id: string): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.SETTINGS_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: log } = await supabase.from("weight_logs").select("cattle_id").eq("id", id).maybeSingle();
  if (!log) return { error: "Log not found" };
  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", log.cattle_id).maybeSingle();
  if (!cattle || cattle.business_id !== bizId) return { error: "Unauthorized" };

  const { error } = await supabase.from("weight_logs").update({ deleted_at: null }).eq("id", id);
  if (error) return { error: "Failed to restore" };
  revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/settings/trash");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function permanentlyDelete(
  table: "cost_entries" | "inventory_items" | "weight_logs",
  id: string
): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.SETTINGS_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  if (table === "cost_entries") {
    const { data: row } = await supabase.from("cost_entries").select("business_id").eq("id", id).maybeSingle();
    if (!row || row.business_id !== bizId) return { error: "Unauthorized" };
  } else if (table === "inventory_items") {
    const { data: row } = await supabase.from("inventory_items").select("business_id").eq("id", id).maybeSingle();
    if (!row || row.business_id !== bizId) return { error: "Unauthorized" };
    // Permanently deleting an inventory item cascades all its transaction history — block if any exist
    const { count: txnCount } = await supabase
      .from("inventory_transactions")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id);
    if ((txnCount ?? 0) > 0)
      return { error: `Cannot permanently delete — this item has ${txnCount} purchase/consumption records. Deleting it would destroy all stock history. Keep it archived.` };
  } else if (table === "weight_logs") {
    const { data: log } = await supabase.from("weight_logs").select("cattle_id").eq("id", id).maybeSingle();
    if (!log) return { error: "Log not found" };
    const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", log.cattle_id).maybeSingle();
    if (!cattle || cattle.business_id !== bizId) return { error: "Unauthorized" };
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: "Failed to permanently delete" };
  revalidatePath("/dashboard/settings/trash");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

/**
 * Empty the trash: every soft-deleted expense, weight and stock item of this farm is removed for
 * good. Kept (and counted in `kept`): stock items that still have purchase/usage history, a recipe
 * or a feeding period, and an expense a fixed asset points to — deleting those would break
 * other records.
 */
export async function emptyTrash(): Promise<{ error?: string; removed?: number; kept?: number }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.SETTINGS_EDIT);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  let removed = 0;
  let kept = 0;

  // expenses (not one a fixed asset was bought with)
  const { data: costs } = await supabase.from("cost_entries").select("id").eq("business_id", bizId).not("deleted_at", "is", null);
  const costIds = (costs ?? []).map((c) => c.id);
  if (costIds.length) {
    const { data: linked } = await supabase.from("fixed_assets").select("source_cost_entry_id").in("source_cost_entry_id", costIds);
    const keep = new Set((linked ?? []).map((l) => l.source_cost_entry_id));
    const del = costIds.filter((id) => !keep.has(id));
    kept += keep.size;
    if (del.length) {
      const { error } = await supabase.from("cost_entries").delete().in("id", del);
      if (error) return { error: "Could not empty the expenses in the trash" };
      removed += del.length;
    }
  }

  // weights of this farm's animals
  const { data: logs } = await supabase.from("weight_logs").select("id, cattle!inner(business_id)").eq("cattle.business_id", bizId).not("deleted_at", "is", null);
  const logIds = ((logs ?? []) as { id: string }[]).map((l) => l.id);
  if (logIds.length) {
    const { error } = await supabase.from("weight_logs").delete().in("id", logIds);
    if (error) return { error: "Could not empty the weights in the trash" };
    removed += logIds.length;
  }

  // stock items: only those with no history (the database refuses the others; they stay archived)
  const { data: items } = await supabase.from("inventory_items").select("id").eq("business_id", bizId).not("deleted_at", "is", null);
  for (const { id } of items ?? []) {
    const { count } = await supabase.from("inventory_transactions").select("id", { count: "exact", head: true }).eq("item_id", id);
    if ((count ?? 0) > 0) { kept++; continue; }
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) kept++; else removed++;
  }

  revalidatePath("/dashboard/settings/trash");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { removed, kept };
}
