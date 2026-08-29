 
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Current stock on hand for an item (all purchases − all consumptions).
 */
 
export async function getItemStock(
  supabase: SupabaseClient<any>,
  item_id: string
): Promise<number> {
  const [{ data: purchases }, { data: consumptions }] = await Promise.all([
    supabase.from("inventory_transactions").select("qty").eq("item_id", item_id).eq("type", "purchase"),
    supabase.from("inventory_transactions").select("qty").eq("item_id", item_id).eq("type", "consumption"),
  ]);
  const inQty  = ((purchases    ?? []) as { qty: number }[]).reduce((s, r) => s + r.qty, 0);
  const outQty = ((consumptions ?? []) as { qty: number }[]).reduce((s, r) => s + r.qty, 0);
  return Math.max(0, inQty - outQty);
}

/**
 * Computes the weighted-average FIFO unit cost for consuming `consumeQty` units
 * of `item_id`, taking into account all previously consumed batches.
 * Returns null when no purchase price data is available.
 */
 
export async function computeFIFOUnitCost(
  supabase: SupabaseClient<any>,
  item_id: string,
  consumeQty: number
): Promise<number | null> {
  const [{ data: purchases }, { data: consumed }] = await Promise.all([
    supabase
      .from("inventory_transactions")
      .select("qty, unit_cost, recorded_at")
      .eq("item_id", item_id)
      .eq("type", "purchase")
      .order("recorded_at", { ascending: true }),
    supabase
      .from("inventory_transactions")
      .select("qty")
      .eq("item_id", item_id)
      .eq("type", "consumption"),
  ]);

  if (!purchases?.length) return null;

  const prevConsumed = ((consumed ?? []) as { qty: number }[]).reduce((s, r) => s + r.qty, 0);
  const batches = (purchases as { qty: number; unit_cost: number | null }[]).map((p) => ({
    qty: p.qty,
    unit_cost: p.unit_cost,
  }));

  // Burn off previously consumed qty from oldest batches
  let remaining = prevConsumed;
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.qty);
    b.qty -= take;
    remaining -= take;
  }

  let totalCost = 0;
  let coveredQty = 0;
  let leftToConsume = consumeQty;
  for (const b of batches) {
    if (leftToConsume <= 0) break;
    if (b.qty <= 0) continue;
    const take = Math.min(leftToConsume, b.qty);
    // Always count the qty consumed, even when unit_cost is null (treat as ৳0 free goods).
    // Excluding null-cost batches from coveredQty inflated the unit cost because the
    // denominator was smaller than the total quantity consumed.
    if (b.unit_cost != null) totalCost += take * b.unit_cost;
    coveredQty += take;
    leftToConsume -= take;
  }

  return coveredQty > 0 ? totalCost / consumeQty : null;
}
