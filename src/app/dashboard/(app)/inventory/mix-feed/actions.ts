"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";
import { mixBatchSchema } from "@/lib/validation";
import { recordFeedBatch } from "@/lib/inventory/feed-batch";
import { InventoryEventBus } from "@/lib/inventory/events";

export type MixBatchState = { error?: string; success?: boolean; produced?: number } | undefined;

/**
 * Produce a batch of mixed feed from a recipe (internal transformation, not a purchase).
 * Ingredients and output are written atomically by the database; see recordFeedBatch.
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
    const rawBatchId = (formData.get("batch_id") as string)?.trim() || crypto.randomUUID();

    const parsed = mixBatchSchema.safeParse({
      recipe_id: rawRecipeId,
      target_amount: rawTargetAmount,
      recorded_at: rawRecordedAt,
      output_item_id: rawOutputItemId,
      batch_id: rawBatchId,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
    }

    const { recipe_id, target_amount, recorded_at, output_item_id, batch_id } = parsed.data;

    const lockErr = await verifyFinancialLock(supabase, ctx.businessId, recorded_at);
    if (lockErr) return { error: lockErr };

    // Without an output item the mixed feed would vanish from stock and its cost would be lost.
    if (!output_item_id) return { error: "Choose the inventory item that receives the mixed feed" };

    const recipe = await assertResourceOwnership<{ id: string; business_id: string; output_qty: number; name: string }>(
      supabase,
      "feed_recipes",
      recipe_id,
      ctx.businessId
    );
    await assertResourceOwnership(supabase, "inventory_items", output_item_id, ctx.businessId);

    // One database transaction: ingredients out (feed_mix_input, at WAC), mixed feed in
    // (feed_mix_output, at input cost). Scaled by the ingredient total, never a purchase.
    const result = await recordFeedBatch(supabase, {
      businessId: ctx.businessId,
      recipeId: recipe_id,
      outputItemId: output_item_id,
      outputQty: target_amount,
      date: recorded_at,
      batchId: batch_id,
    });
    if (result.error) return { error: result.error };

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