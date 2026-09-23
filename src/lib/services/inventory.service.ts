import type { SupabaseClient } from "@supabase/supabase-js";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";

export class InventoryDomainService {
  /**
   * Retrieves current stock balance on hand for an item via Central Inventory Core.
   */
  public static async getStockOnHand(
    supabase: SupabaseClient<any>,
    itemId: string
  ): Promise<number> {
    return CentralInventoryRepository.getItemStockOnHand(supabase, itemId);
  }

  /**
   * Computes weighted FIFO unit cost for consuming `quantity` units of `itemId` via Central Inventory Core.
   */
  public static async getEstimatedFifoUnitCost(
    supabase: SupabaseClient<any>,
    itemId: string,
    quantity = 1
  ): Promise<number | null> {
    return CentralInventoryRepository.getEstimatedFifoUnitCost(supabase, itemId, quantity);
  }
}