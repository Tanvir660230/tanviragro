"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";
import { recipeValidationError } from "@/lib/inventory/recipe-math";
import { recordFeedBatch } from "@/lib/inventory/feed-batch";

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
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
  // Mass balance: Σ ingredients must equal the batch size (the database enforces it for active recipes).
  const invalid = recipeValidationError(ingredients, output_qty);
  if (invalid) return { error: invalid };

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
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.INVENTORY_DELETE);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
// Mixing is an internal transformation recorded by the database in one transaction
// (produce_feed_batch): ingredients scale by the recipe's ingredient total, the output is
// valued at the inputs' cost, and nothing is booked as a purchase or cash.
export async function produceBatch(
  _prev: ProduceBatchState,
  formData: FormData
): Promise<ProduceBatchState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  const recipe_id  = formData.get("recipe_id") as string;
  const qty_to_produce = parseFloat(formData.get("qty_to_produce") as string);
  const recorded_at = formData.get("recorded_at") as string;
  const output_item_id = (formData.get("output_item_id") as string) || null;
  const batch_id = (formData.get("batch_id") as string) || crypto.randomUUID();

  if (!recipe_id) return { error: "Recipe is required" };
  if (isNaN(qty_to_produce) || qty_to_produce <= 0) return { error: "Quantity must be > 0" };
  if (!recorded_at) return { error: "Date is required" };
  // Without an output item the mixed feed would vanish from stock and its cost would be lost.
  if (!output_item_id) return { error: "Choose the inventory item that receives the mixed feed" };
  if (!UUID_RE.test(batch_id)) return { error: "Invalid batch id" };

  const result = await recordFeedBatch(supabase, {
    businessId: bizId,
    recipeId: recipe_id,
    outputItemId: output_item_id,
    outputQty: qty_to_produce,
    date: recorded_at,
    batchId: batch_id,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/inventory");
  revalidateTag("accounting", { expire: 0 });
  return { success: true, produced: qty_to_produce };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Supplement Rules ──────────────────────────────────────────────
export type SupplementRuleState = { error?: string; success?: boolean } | undefined;

export async function createSupplementRule(
  _prev: SupplementRuleState,
  formData: FormData
): Promise<SupplementRuleState> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { error: permissionDenied };
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
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getBizId(supabase, user.id);
  if (!bizId) return { error: "Business not found" };

  // Refuse to activate an unbalanced recipe BEFORE deactivating the current one, so the
  // farm is never left without an active recipe (the database rejects it as well).
  if (id) {
    const { data: target } = await supabase
      .from("feed_recipes")
      .select("business_id, output_qty, recipe_ingredients(item_id, qty_per_batch)")
      .eq("id", id)
      .maybeSingle();
    if (!target || target.business_id !== bizId) return { error: "Recipe not found" };
    const invalid = recipeValidationError(
      (target.recipe_ingredients ?? []) as { item_id: string; qty_per_batch: number }[],
      Number(target.output_qty)
    );
    if (invalid) return { error: `This recipe cannot be activated: ${invalid}` };
  }

  // First, unset all active recipes for this business, preserving active_from and setting active_until to now
  const nowStr = new Date().toISOString();
  await supabase
    .from("feed_recipes")
    .update({ is_active: false, active_until: nowStr })
    .eq("business_id", bizId)
    .eq("is_active", true);

  // Then set the new one
  if (id) {
    const from = activeFrom ?? todayDhaka();
    const { error } = await supabase
      .from("feed_recipes")
      .update({ is_active: true, active_from: from, active_until: activeUntil ?? null })
      .eq("id", id)
      .eq("business_id", bizId);

    if (error) return { error: "Failed to set active recipe" };
    // Activating a recipe only changes the PLAN. It never creates consumption.
  }

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function updateRecipeActiveFrom(activeFrom: string | null): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
  // Changing the start date only changes the PLAN. It never creates back-dated consumption.

  revalidatePath("/dashboard/inventory");
  return {};
}

export async function updateRecipeActiveUntil(activeUntil: string | null): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.FEED_MIX);
  if (permissionDenied) return { error: permissionDenied };
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
