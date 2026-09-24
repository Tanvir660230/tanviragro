import type { ServerClient } from "@/lib/supabase/server";

/**
 * Records one feed-mixing batch through the database function produce_feed_batch.
 *
 * Mixing is an internal transformation: ingredients leave stock as feed_mix_input
 * (valued at weighted-average cost), the mixed feed enters as feed_mix_output valued at
 * the inputs' cost. It is never a purchase and never cash. All rows are written in one
 * database transaction; `batchId` makes a double submit fail instead of deducting twice.
 */
export async function recordFeedBatch(
  supabase: ServerClient,
  args: { businessId: string; recipeId: string; outputItemId: string; outputQty: number; date: string; batchId: string }
): Promise<{ error?: string; batchCost?: number | null }> {
  const { data, error } = await supabase.rpc("produce_feed_batch", {
    p_business_id: args.businessId,
    p_recipe_id: args.recipeId,
    p_output_item_id: args.outputItemId,
    p_output_qty: args.outputQty,
    p_date: args.date,
    p_batch_id: args.batchId,
  });
  if (error) return { error: feedLedgerErrorMessage(error) };
  return { batchCost: data as number | null };
}

/** Maps ledger database errors to messages a farm user can act on. */
export function feedLedgerErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "This was already recorded. Nothing was deducted twice.";
  if (error.code === "23514") {
    return error.message?.startsWith("Insufficient stock")
      ? "Not enough stock for one of the items. Record the purchase or a stock count first."
      : error.message || "The values are not valid.";
  }
  if (error.code === "42501") return "An item or recipe does not belong to this business.";
  return "Could not save. Please try again.";
}
