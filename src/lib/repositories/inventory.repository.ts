import { BaseRepository } from "./base.repository";
import type { InventoryItem, InventoryTransaction, FeedRecipe } from "@/types/database";
import { CentralInventoryRepository } from "@/lib/inventory/inventory-repository";
import type { ItemStockSummary, StockLedgerEntry, StockValuationBreakdown } from "@/lib/inventory/types";

export class InventoryRepository extends BaseRepository {
  public async getItems(): Promise<InventoryItem[]> {
    const { data, error } = await this.supabase
      .from("inventory_items")
      .select("*")
      .eq("business_id", this.businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) this.handleDbError(error, "Get inventory items");
    return (data ?? []) as InventoryItem[];
  }

  public async getItemById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await this.supabase
      .from("inventory_items")
      .select("*")
      .eq("id", id)
      .eq("business_id", this.businessId)
      .maybeSingle();

    if (error) this.handleDbError(error, "Get inventory item by ID");
    return data as InventoryItem | null;
  }

  public async getInventoryStats(thirtyDaysAgoIso: string) {
    const { data, error } = await this.supabase.rpc("get_inventory_stats", {
      p_business_id: this.businessId,
      p_30_days_ago: thirtyDaysAgoIso,
    });

    if (error) this.handleDbError(error, "Get inventory stats RPC");
    return data ?? [];
  }

  public async getInventoryPortfolio(): Promise<ItemStockSummary[]> {
    return CentralInventoryRepository.getInventoryPortfolio(this.supabase, this.businessId);
  }

  public async getItemStockLedger(itemId: string): Promise<{ item: any; ledger: StockLedgerEntry[]; valuation: StockValuationBreakdown | null }> {
    return CentralInventoryRepository.getItemStockLedger(this.supabase, this.businessId, itemId);
  }

  public async getItemStockOnHand(itemId: string): Promise<number> {
    return CentralInventoryRepository.getItemStockOnHand(this.supabase, itemId);
  }

  public async getEstimatedFifoUnitCost(itemId: string, quantity = 1): Promise<number | null> {
    return CentralInventoryRepository.getEstimatedFifoUnitCost(this.supabase, itemId, quantity);
  }

  public async insertTransaction(txn: Omit<InventoryTransaction, "id" | "created_at">): Promise<InventoryTransaction> {
    const { data, error } = await this.supabase
      .from("inventory_transactions")
      .insert(txn)
      .select("*")
      .single();

    if (error) this.handleDbError(error, "Insert inventory transaction");
    return data as InventoryTransaction;
  }

  public async getFeedRecipes(): Promise<FeedRecipe[]> {
    const { data, error } = await this.supabase
      .from("feed_recipes")
      .select("*, recipe_ingredients(*, inventory_items(name, unit))")
      .eq("business_id", this.businessId)
      .is("deleted_at", null);

    if (error) this.handleDbError(error, "Get feed recipes");
    return (data ?? []) as FeedRecipe[];
  }
}