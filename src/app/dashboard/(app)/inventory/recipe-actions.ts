"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RecipeFormState = { error?: string; success?: boolean; id?: string } | undefined;
export type ProduceBatchState = { error?: string; success?: boolean; produced?: number } | undefined;

async function getBizId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Create Recipe ─────────────────────────────────────────────────
export async function createRecipe(
  _prev: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const name       = (formData.get("name") as string)?.trim();
  const output_qty = parseFloat(formData.get("output_qty") as string);
  const output_unit = (formData.get("output_unit") as string)?.trim() || "kg";
  const notes      = (formData.get("notes") as string)?.trim() || null;
  const ingredientsJson = formData.get("ingredients") as string;

  if (!name) return { error: "Recipe name is required" };
  if (isNaN(output_qty) || output_qty <= 0) return { error: "Output quantity must be > 0" };

  let ingredients: { item_id: string; qty_per_batch: number }[] = [];
  try {
    ingredients = JSON.parse(ingredientsJson);
  } catch {
    return { error: "Invalid ingredients data" };
  }
  if (!ingredients.length) return { error: "Add at least one ingredient" };
  for (const ing of ingredients) {
    if (!ing.item_id) return { error: "Each ingredient must have an item" };
    if (!(ing.qty_per_batch > 0)) return { error: "Each ingredient qty must be > 0" };
  }

  const { data: recipe, error: recipeErr } = await supabase
    .from("feed_recipes")
    .insert({ business_id: bizId, name, output_qty, output_unit, notes })
    .select("id")
    .single();

  if (recipeErr || !recipe) {
    console.error("Recipe creation error:", recipeErr);
    return { error: recipeErr?.message || "Failed to create recipe" };
  }

  const rows = ingredients.map((i) => ({
    recipe_id: recipe.id,
    item_id: i.item_id,
    qty_per_batch: i.qty_per_batch,
  }));
  const { error: ingErr } = await supabase.from("recipe_ingredients").insert(rows);
  if (ingErr) {
    console.error("Ingredients creation error:", ingErr);
    await supabase.from("feed_recipes").delete().eq("id", recipe.id);
    return { error: ingErr.message || "Failed to save ingredients" };
  }

  revalidatePath("/dashboard/inventory");
  return { success: true, id: recipe.id };
}

// ── Delete Recipe (soft-delete — preserves ingredient cascade history) ───────
export async function deleteRecipe(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: recipe } = await supabase
    .from("feed_recipes")
    .select("business_id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!recipe || recipe.business_id !== bizId) return { error: "Unauthorized" };

  // Prevent deleting the currently active recipe — deactivate first
  if (recipe.is_active) {
    return { error: "এই recipe এখন active। Delete করার আগে deactivate করুন।" };
  }

  // Soft-delete: set deleted_at so recipe can be recovered and history is preserved
  const { error } = await supabase
    .from("feed_recipes")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);

  if (error) return { error: "Failed to delete recipe" };
  revalidatePath("/dashboard/inventory");
  return {};
}

// Permanently deletes the recipe formula. Inventory transaction history is unaffected
// (transactions are keyed to item_id, not recipe_id — they survive this deletion).
export async function permanentlyDeleteRecipe(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: recipe } = await supabase
    .from("feed_recipes")
    .select("business_id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!recipe || recipe.business_id !== bizId) return { error: "Unauthorized" };
  if (recipe.is_active) return { error: "Deactivate the recipe before deleting it permanently." };

  // Hard delete — recipe_ingredients cascade-delete too.
  // inventory_transactions are NOT affected (no FK to feed_recipes).
  await supabase.from("feed_recipes").delete().eq("id", id);
  revalidatePath("/dashboard/inventory");
  return {};
}

export async function restoreRecipe(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: recipe } = await supabase
    .from("feed_recipes")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!recipe || recipe.business_id !== bizId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("feed_recipes")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) return { error: "Failed to restore recipe" };
  revalidatePath("/dashboard/inventory");
  return {};
}

// ── Produce Batch ─────────────────────────────────────────────────
// Deducts ingredients proportionally and creates consumption transactions
export async function produceBatch(
  _prev: ProduceBatchState,
  formData: FormData
): Promise<ProduceBatchState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const recipe_id  = formData.get("recipe_id") as string;
  const qty_to_produce = parseFloat(formData.get("qty_to_produce") as string);
  const recorded_at = formData.get("recorded_at") as string;
  const output_item_id = (formData.get("output_item_id") as string) || null;

  if (!recipe_id) return { error: "Recipe is required" };
  if (isNaN(qty_to_produce) || qty_to_produce <= 0) return { error: "Quantity must be > 0" };
  if (!recorded_at) return { error: "Date is required" };

  // Fetch recipe + verify ownership
  const { data: recipe } = await supabase
    .from("feed_recipes")
    .select("id, business_id, output_qty, name")
    .eq("id", recipe_id)
    .maybeSingle();
  if (!recipe || recipe.business_id !== bizId) return { error: "Recipe not found" };

  // Fetch ingredients
  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("item_id, qty_per_batch")
    .eq("recipe_id", recipe_id);

  if (!ingredients?.length) return { error: "Recipe has no ingredients" };

  const scale = qty_to_produce / recipe.output_qty;

  // Check stock for each ingredient
  const itemIds = ingredients.map((i) => i.item_id);
  const { data: txns } = await supabase
    .from("inventory_transactions")
    .select("item_id, type, qty, unit_cost, recorded_at")
    .in("item_id", itemIds)
    .order("recorded_at", { ascending: true });

  const stockMap: Record<string, number> = {};
  for (const tx of txns ?? []) {
    stockMap[tx.item_id] = (stockMap[tx.item_id] ?? 0) + (tx.type === "purchase" ? tx.qty : -tx.qty);
  }

  for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
    const need = ing.qty_per_batch * scale;
    const have = stockMap[ing.item_id] ?? 0;
    if (have < need - 0.001) {
      return { error: `Insufficient stock for ingredient (need ${need.toFixed(2)}, have ${have.toFixed(2)})` };
    }
  }

  // Create consumption transactions for each ingredient
  const consumptions = (ingredients as { item_id: string; qty_per_batch: number }[]).map((ing) => ({
    item_id: ing.item_id,
    type: "consumption" as const,
    qty: parseFloat((ing.qty_per_batch * scale).toFixed(4)),
    recorded_at,
    notes: `Batch production: ${recipe.name} ×${qty_to_produce}`,
  }));

  const { error: txnErr } = await supabase.from("inventory_transactions").insert(consumptions);
  if (txnErr) return { error: "Failed to record ingredient consumption" };

  // If user selected an output item, add it as a purchase (stock in)
  // Compute true FIFO-weighted ingredient cost per unit of output
  if (output_item_id) {
    let totalIngCost = 0;
    for (const ing of ingredients as { item_id: string; qty_per_batch: number }[]) {
      const ingQty = ing.qty_per_batch * scale;
      const allIngTxns = ((txns ?? []) as { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string }[])
        .filter((t) => t.item_id === ing.item_id);

      // FIFO: burn off already-consumed qty from oldest purchase batches
      const purchases = allIngTxns
        .filter((t) => t.type === "purchase")
        .map((p) => ({ qty: p.qty, unit_cost: p.unit_cost }));
      const prevConsumed = allIngTxns
        .filter((t) => t.type === "consumption")
        .reduce((s, t) => s + t.qty, 0);

      let rem = prevConsumed;
      for (const b of purchases) {
        if (rem <= 0) break;
        const take = Math.min(rem, b.qty);
        b.qty -= take;
        rem -= take;
      }

      let ingCost = 0;
      let coveredQty = 0;
      let leftToCover = ingQty;
      for (const b of purchases) {
        if (leftToCover <= 0) break;
        if (b.qty <= 0) continue;
        const take = Math.min(leftToCover, b.qty);
        if (b.unit_cost != null) { ingCost += take * b.unit_cost; coveredQty += take; }
        leftToCover -= take;
      }
      const fifoUnitCost = coveredQty > 0 ? ingCost / coveredQty : 0;
      totalIngCost += ingQty * fifoUnitCost;
    }
    const outputUnitCost = qty_to_produce > 0 ? totalIngCost / qty_to_produce : null;

    const { error: outputErr } = await supabase.from("inventory_transactions").insert({
      item_id: output_item_id,
      type: "purchase",
      qty: qty_to_produce,
      unit_cost: outputUnitCost ?? null,
      recorded_at,
      notes: `Produced from recipe: ${recipe.name}`,
    });
    if (outputErr) {
      return { error: "Ingredients consumed but output stock could not be added. Please manually record the produced batch in inventory." };
    }
  }

  revalidatePath("/dashboard/inventory");
  return { success: true, produced: qty_to_produce };
}

// ── Supplement Rules ──────────────────────────────────────────────
export type SupplementRuleState = { error?: string; success?: boolean } | undefined;

export async function createSupplementRule(
  _prev: SupplementRuleState,
  formData: FormData
): Promise<SupplementRuleState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const feed_item_id       = formData.get("feed_item_id") as string;
  const supplement_item_id = formData.get("supplement_item_id") as string;
  const qty_per_100        = parseFloat(formData.get("qty_per_100") as string);

  if (!feed_item_id || !supplement_item_id) return { error: "Both items are required" };
  if (feed_item_id === supplement_item_id) return { error: "Feed and supplement must be different items" };
  if (isNaN(qty_per_100) || qty_per_100 <= 0) return { error: "Quantity must be > 0" };

  const { error } = await supabase.from("supplement_rules").insert({
    business_id: bizId,
    feed_item_id,
    supplement_item_id,
    qty_per_100,
  });

  if (error?.code === "23505") return { error: "A rule for this feed + supplement pair already exists" };
  if (error) return { error: "Failed to save rule" };

  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteSupplementRule(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: rule } = await supabase
    .from("supplement_rules")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!rule || rule.business_id !== bizId) return { error: "Unauthorized" };

  await supabase.from("supplement_rules").delete().eq("id", id);
  revalidatePath("/dashboard/inventory");
  return {};
}

// ── Medicine Protocol ─────────────────────────────────────────────
export type MedicineProtocolState = { error?: string; success?: boolean } | undefined;

export async function upsertMedicineProtocol(
  _prev: MedicineProtocolState,
  formData: FormData
): Promise<MedicineProtocolState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const item_id               = formData.get("item_id") as string;
  const dose_per_100kg_weight = parseFloat(formData.get("dose_per_100kg_weight") as string);
  const freq                  = formData.get("frequency_days") as string;
  const frequency_days        = freq ? parseInt(freq, 10) : null;
  const notes                 = (formData.get("notes") as string)?.trim() || null;

  if (!item_id) return { error: "Item is required" };
  if (isNaN(dose_per_100kg_weight) || dose_per_100kg_weight <= 0) return { error: "Dose must be > 0" };

  const { error } = await supabase.from("medicine_protocols").upsert(
    { item_id, dose_per_100kg_weight, frequency_days, notes },
    { onConflict: "item_id" }
  );

  if (error) return { error: "Failed to save protocol" };
  revalidatePath("/dashboard/inventory");
  return { success: true };
}

export async function deleteMedicineProtocol(item_id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { data: item } = await supabase
    .from("inventory_items")
    .select("business_id")
    .eq("id", item_id)
    .maybeSingle();
  if (!item || item.business_id !== bizId) return { error: "Unauthorized" };

  await supabase.from("medicine_protocols").delete().eq("item_id", item_id);
  revalidatePath("/dashboard/inventory");
  return {};
}

// ── Active Recipe Settings ────────────────────────────────────────
export async function setActiveRecipe(
  id: string | null,
  activeUntil?: string | null,
  activeFrom?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  // First, unset all active recipes for this business, preserving active_from and setting active_until to now
  const nowStr = new Date().toISOString();
  await supabase
    .from("feed_recipes")
    .update({ is_active: false, active_until: nowStr })
    .eq("business_id", bizId)
    .eq("is_active", true);

  // Then set the new one
  if (id) {
    const from = activeFrom ?? new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("feed_recipes")
      .update({ is_active: true, active_from: from, active_until: activeUntil ?? null })
      .eq("id", id)
      .eq("business_id", bizId);

    if (error) return { error: "Failed to set active recipe" };

    // Trigger auto-engine immediately — it will catch up from active_from
    const { runAutoFeedDeductions } = await import("./actions");
    await runAutoFeedDeductions();
  }

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function updateRecipeActiveFrom(activeFrom: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { error } = await supabase
    .from("feed_recipes")
    .update({ active_from: activeFrom })
    .eq("business_id", bizId)
    .eq("is_active", true);

  if (error) return { error: "Failed to update start date" };

  // Re-run engine from the new start date
  const { runAutoFeedDeductions } = await import("./actions");
  await runAutoFeedDeductions();

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function updateRecipeActiveUntil(activeUntil: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const { error } = await supabase
    .from("feed_recipes")
    .update({ active_until: activeUntil })
    .eq("business_id", bizId)
    .eq("is_active", true);

  if (error) return { error: "Failed to update date" };
  revalidatePath("/dashboard/inventory");
  return {};
}
