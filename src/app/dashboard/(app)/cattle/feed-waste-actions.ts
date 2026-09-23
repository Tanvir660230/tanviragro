"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { type FeedingSlot } from "@/lib/nutrition/nutrition-engine";
import { type FeedActionResult } from "./feed-session-actions";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

export async function quickDispenseFeedAction(
  cattleIds: string[],
  feedItemId: string,
  dispenseKgPerHead: number,
  slot: FeedingSlot = "morning",
  recordedAt: string = new Date().toISOString().slice(0, 10),
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

    const { data: lastPurchase } = await supabase
      .from("inventory_transactions")
      .select("unit_cost")
      .eq("item_id", feedItemId)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    const unitCost = lastPurchase?.unit_cost ?? 0;

    const txns = cattleIds.map((cid) => ({
      item_id: feedItemId,
      cattle_id: cid,
      type: "consumption" as const,
      qty: dispenseKgPerHead,
      unit_cost: unitCost > 0 ? unitCost : undefined,
      recorded_at: recordedAt,
      notes: `Quick Dispense (${slot.toUpperCase()}) | Feeder: ${feederName}`,
    }));

    const { error: txnErr } = await supabase.from("inventory_transactions").insert(txns);
    if (txnErr) return { error: txnErr.message };

    if (unitCost > 0) {
      const costs = cattleIds.map((cid) => ({
        business_id: businessId,
        cattle_id: cid,
        category: "Feed & Nutrition",
        amount: Math.round(dispenseKgPerHead * unitCost * 100) / 100,
        type: "variable" as const,
        entry_class: "expense" as const,
        recorded_at: recordedAt,
        description: `Quick Feed (${slot}) - ${item.name} (${dispenseKgPerHead} kg)`,
      }));
      await supabase.from("cost_entries").insert(costs);
    }

    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");
    return {
      success: true,
      totalKgDispensed: cattleIds.length * dispenseKgPerHead,
      totalCostBdt: Math.round(cattleIds.length * dispenseKgPerHead * unitCost * 100) / 100,
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
  recordedAt: string = new Date().toISOString().slice(0, 10),
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

    const { error: txnErr } = await supabase.from("inventory_transactions").insert({
      item_id: feedItemId,
      cattle_id: cattleId || undefined,
      type: "consumption",
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
