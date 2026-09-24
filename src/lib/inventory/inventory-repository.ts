import type { SupabaseClient } from "@supabase/supabase-js";
import { StockLedgerEngine, type RawInventoryItemRow, type RawInventoryTxnRow } from "./stock-ledger";
import { CostingEngine } from "./costing-engine";
import type { ItemStockSummary, StockLedgerEntry, StockValuationBreakdown } from "./types";
import { loadUnitCostMap } from "./unit-cost";

/**
 * High-Performance Central Inventory Repository
 * Single point of access for inventory, feed recipes, and transactional logs with zero duplicate reads.
 */
export class CentralInventoryRepository {
  /**
   * Fetches all active inventory items and transactions for a business, compiling complete portfolio stats.
   */
  public static async getInventoryPortfolio(
    supabase: SupabaseClient<any>,
    businessId: string
  ): Promise<ItemStockSummary[]> {
    const [{ data: items }, { data: txns }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, business_id, name, unit, category, low_stock_threshold, is_active_roughage, is_discontinued, deleted_at")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("inventory_transactions")
        .select("id, item_id, type, movement_type, qty, unit_cost, cattle_id, recorded_at, notes, created_at, inventory_items!inner(business_id)")
        .eq("inventory_items.business_id", businessId)
        .order("recorded_at", { ascending: false }),
    ]);

    return StockLedgerEngine.compileInventoryPortfolio(
      (items ?? []) as RawInventoryItemRow[],
      (txns ?? []) as RawInventoryTxnRow[],
      {},
      await loadUnitCostMap(supabase, businessId)
    );
  }

  /**
   * Fetches the full historical Stock Ledger for a specific item.
   */
  public static async getItemStockLedger(
    supabase: SupabaseClient<any>,
    businessId: string,
    itemId: string
  ): Promise<{ item: RawInventoryItemRow | null; ledger: StockLedgerEntry[]; valuation: StockValuationBreakdown | null }> {
    const [{ data: item }, { data: txns }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, business_id, name, unit, category, low_stock_threshold, is_active_roughage, is_discontinued, deleted_at")
        .eq("id", itemId)
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("inventory_transactions")
        .select("id, item_id, type, movement_type, qty, unit_cost, cattle_id, recorded_at, notes, created_at")
        .eq("item_id", itemId)
        .order("recorded_at", { ascending: true }),
    ]);

    if (!item) return { item: null, ledger: [], valuation: null };

    const ledger = StockLedgerEngine.compileStockLedger(
      item as RawInventoryItemRow,
      (txns ?? []) as RawInventoryTxnRow[]
    );

    const valuation = CostingEngine.calculateInventoryValuation(
      item.id,
      item.name,
      item.unit,
      (txns ?? []).map((t) => ({
        id: t.id,
        itemId: t.item_id,
        type: t.type as "purchase" | "consumption",
        qty: t.qty,
        unitCost: t.unit_cost,
        recordedAt: t.recorded_at,
      }))
    );

    return { item: item as RawInventoryItemRow, ledger, valuation };
  }

  /**
   * Fast stock on hand lookup for an item.
   */
  public static async getItemStockOnHand(
    supabase: SupabaseClient<any>,
    itemId: string
  ): Promise<number> {
    const { data: txns } = await supabase
      .from("inventory_transactions")
      .select("type, qty")
      .eq("item_id", itemId);

    return StockLedgerEngine.calculateItemStockOnHand(txns ?? []);
  }

  /**
   * Fast FIFO unit cost calculator for consuming `consumeQty` of an item.
   */
  public static async getEstimatedFifoUnitCost(
    supabase: SupabaseClient<any>,
    itemId: string,
    consumeQty = 1
  ): Promise<number | null> {
    const [{ data: purchases }, { data: consumptions }] = await Promise.all([
      supabase
        .from("inventory_transactions")
        .select("qty, unit_cost, recorded_at")
        .eq("item_id", itemId)
        .eq("type", "purchase").neq("movement_type", "consumption_reversal") // an undo is not a new price
        .order("recorded_at", { ascending: true }),
      supabase
        .from("inventory_transactions")
        .select("qty")
        .eq("item_id", itemId)
        .eq("type", "consumption"),
    ]);

    if (!purchases || purchases.length === 0) return null;

    const totalConsumed = (consumptions ?? []).reduce((s, r) => s + (r.qty || 0), 0);
    return CostingEngine.computeFIFOCost(
      purchases.map((p) => ({
        qty: p.qty,
        unitCost: p.unit_cost,
        recordedAt: p.recorded_at,
      })),
      totalConsumed,
      consumeQty
    );
  }
}