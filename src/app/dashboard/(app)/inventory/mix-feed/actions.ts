"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFIFOUnitCost, getItemStock as getItemStockShared } from "@/lib/inventory-fifo";

export type MixBatchState = { error?: string; success?: boolean; produced?: number } | undefined;

 
async function getBizId(supabase: SupabaseClient<any>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

// getItemStock extracted to src/lib/inventory-fifo.ts
 
const getItemStock = (supabase: SupabaseClient<any>, item_id: string) => getItemStockShared(supabase, item_id);

// computeFIFOCost extracted to src/lib/inventory-fifo.ts
const computeFIFOCost = computeFIFOUnitCost;

/**
 * Produce a scaled batch of mixed feed from a recipe.
 * Atomically deducts all ingredients + selected supplement combos,
 * then optionally stocks the mixed feed output item.
 */
export async function produceMixedBatch(
  _prev: MixBatchState,
  formData: FormData
): Promise<MixBatchState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const recipe_id       = (formData.get("recipe_id") as string)?.trim();
  const target_amount   = parseFloat(formData.get("target_amount") as string);
  const recorded_at     = (formData.get("recorded_at") as string)?.trim();
  const output_item_id  = (formData.get("output_item_id") as string)?.trim() || null;

  if (!recipe_id) return { error: "Recipe is required" };
  if (isNaN(target_amount) || target_amount <= 0) return { error: "Target amount must be > 0" };
  if (!recorded_at) return { error: "Date is required" };

  // Fetch recipe + ownership check
  const { data: recipe } = await supabase
    .from("feed_recipes")
    .select("id, business_id, output_qty, name")
    .eq("id", recipe_id)
    .maybeSingle();
  if (!recipe || recipe.business_id !== bizId) return { error: "Recipe not found" };

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
    .select("id")
    .in("id", itemIds)
    .eq("business_id", bizId);
  const ownedSet = new Set((ownedItems ?? []).map((i: { id: string }) => i.id));
  for (const id of itemIds) {
    if (!ownedSet.has(id)) return { error: "Unauthorized inventory item in recipe" };
  }

  // Stock preflight  ingredients
  for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
    const need = ing.qty_per_batch * scale;
    const have = await getItemStock(supabase, ing.item_id);
    if (have < need - 0.001) {
      const { data: itemInfo } = await supabase.from("inventory_items").select("name, unit").eq("id", ing.item_id).maybeSingle();
      const label = itemInfo ? `${itemInfo.name} (${itemInfo.unit})` : ing.item_id;
      return { error: `Insufficient stock: ${label} — need ${need.toFixed(2)}, have ${have.toFixed(2)}` };
    }
  }

  // Supplement logic removed

  // Verify output item ownership BEFORE consuming any ingredients
  if (output_item_id) {
    const { data: outItemPreflight } = await supabase
      .from("inventory_items")
      .select("business_id")
      .eq("id", output_item_id)
      .maybeSingle();
    if (!outItemPreflight || outItemPreflight.business_id !== bizId)
      return { error: "Output inventory item not found or unauthorized" };
  }

  //  All preflight checks passed  now commit 

  // Build ingredient consumption rows.
  // When an output_item_id is specified, the total ingredient cost is forwarded to the
  // output item's unit_cost. Ingredient consumption rows must have unit_cost=null so
  // the accounting engine does NOT double-count the cost (once on ingredient consumption
  // and again when the output is consumed later). When there is no output item, compute
  // FIFO cost on each ingredient so the expense is recorded immediately.
  const consumptionRows = await Promise.all(
    (ingredients as { item_id: string; qty_per_batch: number }[]).map(async (ing) => {
      const qty = parseFloat((ing.qty_per_batch * scale).toFixed(4));
      let unit_cost: number | null = null;
      if (!output_item_id) {
        // No output item — cost must be recorded on the consumption row directly.
        try { unit_cost = await computeFIFOCost(supabase, ing.item_id, qty); } catch { /* non-fatal */ }
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

  // Insert all consumption rows atomically
  const allConsumptions = [...consumptionRows];
  const { error: txnErr } = await supabase.from("inventory_transactions").insert(allConsumptions);
  if (txnErr) return { error: "Failed to record ingredient consumption" };

  // If output item is set, add the mixed feed as a purchase (stock-in) with FIFO weighted cost
  // Ownership was already verified in preflight — proceed directly.
  if (output_item_id) {
    {
      // Compute total ingredient cost directly via FIFO (ingredient rows have unit_cost=null
      // to prevent double-counting, so we must calculate the cost separately here).
      let totalIngCost = 0;
      for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
        const qty = parseFloat((ing.qty_per_batch * scale).toFixed(4));
        try {
          const uc = await computeFIFOCost(supabase, ing.item_id, qty);
          if (uc != null) totalIngCost += qty * uc;
        } catch { /* non-fatal — output unit_cost may be partial */ }
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
  }

  revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/mix-feed");
    revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true, produced: target_amount };
}
