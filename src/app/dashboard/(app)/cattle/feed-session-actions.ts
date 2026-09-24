"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { type FeedingSlot } from "@/lib/nutrition/nutrition-engine";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

export interface FeedSessionExecutionPayload {
  dateISO: string;
  slot: FeedingSlot;
  scheduledTime: string;
  targetGroupOrPen: string;
  feederOperator: string;
  feedItemId: string;
  feedItemName: string;
  /** @deprecated ignored: the database values consumption at weighted-average cost */
  unitCostBdt?: number;
  cattleAllocations: {
    cattleId: string;
    tagId: string;
    targetAsFedKg: number;
    actualDispensedKg: number;
    wasteKg: number;
    notes?: string;
  }[];
  sessionNotes?: string;
}

export interface FeedActionResult {
  success?: boolean;
  error?: string;
  warning?: string;
  totalKgDispensed?: number;
  totalCostBdt?: number;
  totalWasteKg?: number;
  recordsCount?: number;
}

export async function executeFeedingSessionAction(
  payload: FeedSessionExecutionPayload
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

    const lockErr = await checkFinancialLock(supabase, businessId, payload.dateISO);
    if (lockErr) return { error: lockErr };

    if (!payload.cattleAllocations || payload.cattleAllocations.length === 0) {
      return { error: "At least one cattle allocation is required" };
    }

    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("id", payload.feedItemId)
      .eq("business_id", businessId)
      .single();

    if (itemErr || !item) {
      return { error: "Feed inventory item not found or unauthorized" };
    }

    // One ledger row per animal. The database sets unit_cost (WAC as of the date); no
    // cost_entries row is written, so the same feed is never counted twice.
    const inventoryTxns: {
      item_id: string;
      cattle_id: string;
      type: "consumption";
      movement_type: "consumption";
      qty: number;
      recorded_at: string;
      notes: string;
    }[] = [];

    let totalKgDispensed = 0;
    let totalWasteKg = 0;

    for (const alloc of payload.cattleAllocations) {
      totalKgDispensed += alloc.actualDispensedKg;
      totalWasteKg += alloc.wasteKg;

      if (alloc.actualDispensedKg > 0) {
        inventoryTxns.push({
          item_id: payload.feedItemId,
          cattle_id: alloc.cattleId,
          type: "consumption",
          movement_type: "consumption",
          qty: alloc.actualDispensedKg,
          recorded_at: payload.dateISO,
          notes: `Feed Session (${payload.slot.toUpperCase()}) | Feeder: ${payload.feederOperator} | Target: ${alloc.targetAsFedKg}kg | Waste: ${alloc.wasteKg}kg ${alloc.notes ? "| " + alloc.notes : ""}`,
        });
      }
    }

    let totalCostBdt = 0;
    if (inventoryTxns.length > 0) {
      const { data: saved, error: txnErr } = await supabase
        .from("inventory_transactions")
        .insert(inventoryTxns)
        .select("qty, unit_cost");
      if (txnErr) {
        return { error: `Failed to deduct inventory: ${txnErr.message}` };
      }
      for (const r of saved ?? []) totalCostBdt += r.qty * (r.unit_cost ?? 0);
    }

    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");

    return {
      success: true,
      totalKgDispensed: Math.round(totalKgDispensed * 100) / 100,
      totalCostBdt: Math.round(totalCostBdt * 100) / 100,
      totalWasteKg: Math.round(totalWasteKg * 100) / 100,
      recordsCount: payload.cattleAllocations.length,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to execute feeding session",
    };
  }
}
