"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type TypedClient = Awaited<ReturnType<typeof createClient>>;

async function getOwnerBizId(supabase: TypedClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function restoreCostEntry(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getOwnerBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: entry } = await supabase.from("cost_entries").select("business_id").eq("id", id).maybeSingle();
  if (!entry || entry.business_id !== bizId) return { error: "Unauthorized" };

  const { error } = await supabase.from("cost_entries").update({ deleted_at: null }).eq("id", id);
  if (error) return { error: "Failed to restore" };
  revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/settings/trash");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function restoreInventoryItem(id: string): Promise<{ error?: string }> {
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
