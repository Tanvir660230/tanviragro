"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** name of the mix item made automatically on the first mix, when the farm has none yet */
const DEFAULT_MIX_NAME = "দানাদার মিক্স";

function done() {
  for (const p of ["/dashboard/inventory/mix", "/dashboard/inventory", "/dashboard/inventory/usage", "/dashboard", "/dashboard/finance", "/dashboard/cattle"]) revalidatePath(p);
  revalidateTag("accounting", { expire: 0 });
}

function message(error: { code?: string; message?: string }): string {
  if (error.code === "23514" || error.code === "P0002" || error.code === "P0001") {
    if (error.message?.startsWith("Insufficient stock")) return "Not enough stock of an ingredient. Enter its purchase first, or lower the quantity.";
    return error.message ?? "Not allowed";
  }
  if (error.code === "42501") return "An item does not belong to this business.";
  return error.message ?? "Could not save. Please try again.";
}

/** Record one dated mix: ingredients (in their own unit) → the mix item, in kg. */
export async function recordFeedMix(input: {
  batchId: string;
  date: string;
  outputItemId: string | null;
  lines: { itemId: string; qty: number }[];
  note?: string | null;
}): Promise<{ error?: string; duplicate?: boolean; outputQty?: number }> {
  const denied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };
  if (!UUID_RE.test(input.batchId)) return { error: "Invalid mix id" };
  if (!DATE_RE.test(input.date)) return { error: "Choose the mix date" };
  const lines = (input.lines ?? []).filter((l) => l.itemId && Number(l.qty) > 0).map((l) => ({ item_id: l.itemId, qty: Math.round(Number(l.qty) * 10000) / 10000 }));
  if (!lines.length) return { error: "Add at least one ingredient with a quantity" };

  // the first mix makes the mix item (kg, feed) unless one exists with that name
  let outputItemId = input.outputItemId;
  if (!outputItemId) {
    const { data: same } = await supabase.from("inventory_items").select("id").eq("business_id", businessId)
      .is("deleted_at", null).ilike("name", DEFAULT_MIX_NAME).limit(1).maybeSingle();
    if (same) outputItemId = same.id;
    else {
      const { data: made, error } = await supabase.from("inventory_items")
        .insert({ business_id: businessId, name: DEFAULT_MIX_NAME, category: "feed", unit: "kg" }).select("id").single();
      if (error || !made) return { error: "Could not create the mix item" };
      outputItemId = made.id;
    }
  }

  const { data, error } = await supabase.rpc("produce_feed_mix", {
    p_business_id: businessId, p_output_item_id: outputItemId!, p_date: input.date, p_lines: lines,
    p_batch_id: input.batchId, p_note: (input.note ?? "").trim() || null,
  });
  if (error) return { error: message(error) };
  done();
  const r = (data ?? {}) as { duplicate?: boolean; output_qty?: number };
  return { duplicate: !!r.duplicate, outputQty: r.output_qty };
}

/** Undo a mix entered by mistake (audited reversals; refused once the mix has been fed). */
export async function undoFeedMix(batchId: string, reason: string): Promise<{ error?: string }> {
  const denied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (denied) return { error: denied };
  if (!UUID_RE.test(batchId)) return { error: "Invalid mix id" };
  if (!reason?.trim()) return { error: "Write why it is undone" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_feed_mix", { p_batch_id: batchId, p_reason: reason.trim() });
  if (error) return { error: message(error) };
  done();
  return {};
}
