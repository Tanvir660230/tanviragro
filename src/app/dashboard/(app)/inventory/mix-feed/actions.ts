"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { mixBatchSchema } from "@/lib/validation";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import { StockLedgerEngine } from "@/lib/inventory/stock-ledger";
import { CostingEngine } from "@/lib/inventory/costing-engine";
import { InventoryEventBus } from "@/lib/inventory/events";

export type MixBatchState = { error?: string; success?: boolean; produced?: number } | undefined;

/**
 * Produce a scaled batch of mixed feed from a recipe.
 * Atomically deducts all ingredients, then optionally stocks the mixed feed output item.
 */
export async function produceMixedBatch(
  _prev: MixBatchState,
  formData: FormData
): Promise<MixBatchState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.FEED_MIX);

    const rawRecipeId = (formData.get("recipe_id") as string)?.trim();
    const rawTargetAmount = parseFloat(formData.get("target_amount") as string);
    const rawRecordedAt = (formData.get("recorded_at") as string)?.trim();
    const rawOutputItemId = (formData.get("output_item_id") as string)?.trim() || null;

    const parsed = mixBatchSchema.safeParse({
      recipe_id: rawRecipeId,
      target_amount: rawTargetAmount,
      recorded_at: rawRecordedAt,
      output_item_id: rawOutputItemId,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
    }

    const { recipe_id, target_amount, recorded_at, output_item_id } = parsed.data;

    const lockErr = await verifyFinancialLock(supabase, ctx.businessId, recorded_at);
    if (lockErr) return { error: lockErr };

    // Fetch recipe + ownership check
    const recipe = await assertResourceOwnership<{ id: string; business_id: string; output_qty: number; name: string }>(
      supabase,
      "feed_recipes",
      recipe_id,
      ctx.businessId
    );

    const scale = target_amount / recipe.output_qty;

    // Fetch recipe ingredients
    const { data: ingredients } = await supabase
      .from("recipe_ingredients")
      .select("item_id, qty_per_batch")
      .eq("recipe_id", recipe_id);
    if (!ingredients?.length) return { error: "Recipe has no ingredients" };

    // Verify all ingredient items belong to this business
    const itemIds = (ingredients as { item_id: string }[]).map((i) => i.item_id);
    const { data: ownedItems } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .in("id", itemIds)
      .eq("business_id", ctx.businessId);

    const ownedMap = new Map((ownedItems ?? []).map((i: { id: string; name: string; unit: string }) => [i.id, i]));
    for (const id of itemIds) {
      if (!ownedMap.has(id)) return { error: "Unauthorized inventory item in recipe" };
    }

    // Stock preflight check for all ingredients
    for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
      const need = ing.qty_per_batch * scale;
      const have = await CentralInventoryRepository.getItemStockOnHand(supabase, ing.item_id);
      const itemInfo = ownedMap.get(ing.item_id);
      const label = itemInfo ? `${itemInfo.name} (${itemInfo.unit})` : ing.item_id;

      if (have < need - 0.001) {
        return { error: `Insufficient stock: ${label} — need ${need.toFixed(2)}, have ${have.toFixed(2)}` };
      }
    }

    // Verify output item ownership BEFORE consuming any ingredients
    if (output_item_id) {
      await assertResourceOwnership(supabase, "inventory_items", output_item_id, ctx.businessId);
    }

    // Build ingredient consumption rows
    const consumptionRows = await Promise.all(
      (ingredients as { item_id: string; qty_per_batch: number }[]).map(async (ing) => {
        const qty = parseFloat((ing.qty_per_batch * scale).toFixed(4));
        let unit_cost: number | null = null;
        if (!output_item_id) {
          try {
            unit_cost = await CentralInventoryRepository.getEstimatedFifoUnitCost(supabase, ing.item_id, qty);
          } catch { /* non-fatal */ }
        }
        return {
          item_id: ing.item_id,
          type: "consumption" as const,
          qty,
          unit_cost,
          recorded_at,
          notes: `Feed mix: ${recipe.name} ×${target_amount} kg`,
        };
      })
    );

    // Insert consumption rows
    const { error: txnErr } = await supabase.from("inventory_transactions").insert(consumptionRows);
    if (txnErr) return { error: "Failed to record ingredient consumption" };

    // If output item is specified, add output batch with FIFO weighted cost
    if (output_item_id) {
      let totalIngCost = 0;
      for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
        const qty = parseFloat((ing.qty_per_batch * scale).toFixed(4));
        try {
          const uc = await CentralInventoryRepository.getEstimatedFifoUnitCost(supabase, ing.item_id, qty);
          if (uc != null) totalIngCost += qty * uc;
        } catch { /* non-fatal */ }
      }
      const outputUnitCost = target_amount > 0 ? totalIngCost / target_amount : null;

      const { error: outputErr } = await supabase.from("inventory_transactions").insert({
        item_id: output_item_id,
        type: "purchase" as const,
        qty: target_amount,
        unit_cost: outputUnitCost ?? null,
        recorded_at,
        notes: `Mixed feed produced from recipe: ${recipe.name}`,
      });
      if (outputErr) {
        return { error: "Ingredients consumed but output stock could not be added. Please manually record the produced batch in inventory." };
      }
    }

    await InventoryEventBus.publish(
      "FeedMixed",
      ctx.businessId,
      {
        recipeId: recipe_id,
        recipeName: recipe.name,
        targetAmount: target_amount,
        recordedAt: recorded_at,
        outputItemId: output_item_id,
      },
      ctx.user.id
    );

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/mix-feed");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });

    return { success: true, produced: target_amount };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to produce mixed feed batch" };
  }
}