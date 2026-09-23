import type { SupabaseClient } from "@supabase/supabase-js";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";

/**
 * Current stock on hand for an item (all purchases − all consumptions).
 * Delegated to the Central Inventory Core.
 */
export async function getItemStock(
  supabase: SupabaseClient<any>,
  item_id: string
): Promise<number> {
  return CentralInventoryRepository.getItemStockOnHand(supabase, item_id);
}

/**
 * Computes the weighted-average FIFO unit cost for consuming `consumeQty` units
 * of `item_id`, taking into account all previously consumed batches.
 * Delegated to the Central Inventory Core.
 */
export async function computeFIFOUnitCost(
  supabase: SupabaseClient<any>,
  item_id: string,
  consumeQty: number
): Promise<number | null> {
  return CentralInventoryRepository.getEstimatedFifoUnitCost(supabase, item_id, consumeQty);
}