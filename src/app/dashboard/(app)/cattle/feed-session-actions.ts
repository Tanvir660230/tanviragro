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
  unitCostBdt: number;
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

    const inventoryTxns: {
      item_id: string;
      cattle_id: string;
      type: "consumption";
      qty: number;
      unit_cost?: number;
      recorded_at: string;
      notes: string;
    }[] = [];

    const costEntries: {
      business_id: string;
      cattle_id: string;
      category: string;
      amount: number;
      type: "variable";
      entry_class: "expense";
      recorded_at: string;
      description: string;
    }[] = [];

    let totalKgDispensed = 0;
    let totalWasteKg = 0;
    let totalCostBdt = 0;

    for (const alloc of payload.cattleAllocations) {
      const rowCost = alloc.actualDispensedKg * payload.unitCostBdt;

      totalKgDispensed += alloc.actualDispensedKg;
      totalWasteKg += alloc.wasteKg;
      totalCostBdt += rowCost;

      if (alloc.actualDispensedKg > 0) {
        inventoryTxns.push({
          item_id: payload.feedItemId,
          cattle_id: alloc.cattleId,
          type: "consumption",
          qty: alloc.actualDispensedKg,
          unit_cost: payload.unitCostBdt > 0 ? payload.unitCostBdt : undefined,
          recorded_at: payload.dateISO,
          notes: `Feed Session (${payload.slot.toUpperCase()}) | Feeder: ${payload.feederOperator} | Target: ${alloc.targetAsFedKg}kg | Waste: ${alloc.wasteKg}kg ${alloc.notes ? "| " + alloc.notes : ""}`,
        });

        if (rowCost > 0) {
          costEntries.push({
            business_id: businessId,
            cattle_id: alloc.cattleId,
            category: "Feed & Nutrition",
            amount: Math.round(rowCost * 100) / 100,
            type: "variable",
            entry_class: "expense",
            recorded_at: payload.dateISO,
            description: `Daily Feeding (${payload.slot}) - ${payload.feedItemName} (${alloc.actualDispensedKg} kg)`,
          });
        }
      }
    }

    if (inventoryTxns.length > 0) {
      const { error: txnErr } = await supabase
        .from("inventory_transactions")
        .insert(inventoryTxns);
      if (txnErr) {
        return { error: `Failed to deduct inventory: ${txnErr.message}` };
      }
    }

    if (costEntries.length > 0) {
      const { error: costErr } = await supabase.from("cost_entries").insert(costEntries);
      if (costErr) {
        console.warn("Feed cost entry insertion warning:", costErr.message);
      }
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
