"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { type FeedingSlot } from "@/lib/nutrition/nutrition-engine";
import { type FeedActionResult } from "./feed-session-actions";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";

export async function quickDispenseFeedAction(
  cattleIds: string[],
  feedItemId: string,
  dispenseKgPerHead: number,
  slot: FeedingSlot = "morning",
  recordedAt: string = todayDhaka(),
  feederName: string = "Farm Feeder"
): Promise<FeedActionResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_CONSUME);
  if (permissionDenied) return { error: permissionDenied };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const businessId = await getCurrentBusinessId(supabase);
    if (!businessId) return { error: "Business workspace not found" };

    const lockErr = await checkFinancialLock(supabase, businessId, recordedAt);
    if (lockErr) return { error: lockErr };

    if (!cattleIds.length || dispenseKgPerHead <= 0) {
      return { error: "Invalid cattle selection or quantity" };
    }

    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("id", feedItemId)
      .eq("business_id", businessId)
      .single();

    if (!item) return { error: "Feed item not found" };

    // Valued by the database at weighted-average cost as of the date (not the latest price).
    // No cost_entries row: the ledger row is the only record of this feed cost.
    const txns = cattleIds.map((cid) => ({
      item_id: feedItemId,
      cattle_id: cid,
      type: "consumption" as const,
      movement_type: "consumption" as const,
      qty: dispenseKgPerHead,
      recorded_at: recordedAt,
      notes: `Quick Dispense (${slot.toUpperCase()}) | Feeder: ${feederName}`,
    }));

    const { data: saved, error: txnErr } = await supabase
      .from("inventory_transactions")
      .insert(txns)
      .select("qty, unit_cost");
    if (txnErr) return { error: txnErr.message };
    const totalCostBdt = (saved ?? []).reduce((s, r) => s + r.qty * (r.unit_cost ?? 0), 0);

    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");
    return {
      success: true,
      totalKgDispensed: cattleIds.length * dispenseKgPerHead,
      totalCostBdt: Math.round(totalCostBdt * 100) / 100,
      recordsCount: cattleIds.length,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Quick dispense failed" };
  }
}

export async function recordFeedWasteAction(
  cattleId: string | null,
  feedItemId: string,
  wasteKg: number,
  wasteReason: "orts_refusal" | "trough_spillage" | "spoilage" | "weather_damage",
  recordedAt: string = todayDhaka(),
  notes?: string
): Promise<FeedActionResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_CONSUME);
  if (permissionDenied) return { error: permissionDenied };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const businessId = await getCurrentBusinessId(supabase);
    if (!businessId) return { error: "Business workspace not found" };

    if (wasteKg <= 0) return { error: "Enter valid waste quantity" };

    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, name")
      .eq("id", feedItemId)
      .eq("business_id", businessId)
      .single();

    if (!item) return { error: "Feed item not found" };

    const lockErr = await checkFinancialLock(supabase, businessId, recordedAt);
    if (lockErr) return { error: lockErr };

    // Wastage is a stock loss, not feed eaten by cattle; valued by the database at WAC.
    const { error: txnErr } = await supabase.from("inventory_transactions").insert({
      item_id: feedItemId,
      cattle_id: cattleId || undefined,
      type: "consumption",
      movement_type: "wastage",
      qty: wasteKg,
      recorded_at: recordedAt,
      notes: `[FEED WASTE / ${wasteReason.toUpperCase()}] ${notes || ""}`,
    });

    if (txnErr) return { error: txnErr.message };

    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard/inventory");
    return { success: true, totalWasteKg: wasteKg };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record feed waste" };
  }
}
