import type {
  StockLedgerEntry,
  ItemStockSummary,
  StockMovementDirection,
  StockTransactionType,
} from "./types";
import { InsufficientStockError, NegativeStockError } from "./errors";

export interface RawInventoryItemRow {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  category: string;
  low_stock_threshold: number | null;
  is_active_roughage: boolean;
  is_discontinued: boolean;
  deleted_at: string | null;
}

export interface RawInventoryTxnRow {
  id: string;
  item_id: string;
  type: "purchase" | "consumption";
  qty: number;
  unit_cost: number | null;
  cattle_id?: string | null;
  recorded_at: string;
  notes?: string | null;
  created_at?: string;
}

/**
 * Enterprise Central Stock Ledger Engine
 * Authoritative single source of truth for stock reconciliations, running balances, and movements.
 */
export class StockLedgerEngine {
  /**
   * Evaluates if a transaction type is an INFLOW or OUTFLOW.
   */
  public static getDirection(type: string): StockMovementDirection {
    if (["purchase", "transfer_in", "adjustment_in", "return", "production_in"].includes(type)) {
      return "IN";
    }
    return "OUT";
  }

  /**
   * Calculates current stock on hand for a specific item from its transaction history.
   */
  public static calculateItemStockOnHand(
    transactions: { type: string; qty: number }[]
  ): number {
    let balance = 0;
    for (const tx of transactions) {
      const dir = this.getDirection(tx.type);
      const qty = Math.max(0, tx.qty || 0);
      if (dir === "IN") {
        balance += qty;
      } else {
        balance -= qty;
      }
    }
    return parseFloat(Math.max(0, balance).toFixed(4));
  }

  /**
   * Compiles the complete chronological Stock Ledger with running balances.
   */
  public static compileStockLedger(
    item: RawInventoryItemRow,
    transactions: RawInventoryTxnRow[]
  ): StockLedgerEntry[] {
    const sorted = [...transactions].sort((a, b) => {
      const dateDiff = new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      // If same date, purchases precede consumptions
      return a.type === "purchase" ? -1 : 1;
    });

    let running = 0;
    const ledger: StockLedgerEntry[] = [];

    for (const tx of sorted) {
      const dir = this.getDirection(tx.type);
      const qty = Math.max(0, tx.qty || 0);

      if (dir === "IN") {
        running += qty;
      } else {
        running -= qty;
      }

      let sourceModule: StockLedgerEntry["sourceModule"] = "manual_adjustment";
      if (tx.notes?.includes("Invoice Memo") || tx.type === "purchase") sourceModule = "purchase";
      if (tx.notes?.includes("Feed mix") || tx.notes?.includes("Produced from recipe")) sourceModule = "feed_mix";
      if (tx.notes?.includes("Daily batch deduction") || tx.notes?.includes("Auto-Feed Deduction")) sourceModule = "daily_deduction";
      if (tx.cattle_id) sourceModule = "cattle_feed";

      const totalCost = tx.unit_cost != null ? parseFloat((qty * tx.unit_cost).toFixed(2)) : null;

      ledger.push({
        id: tx.id,
        businessId: item.business_id,
        itemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        unit: item.unit,
        direction: dir,
        type: tx.type as StockTransactionType,
        quantity: qty,
        unitCost: tx.unit_cost,
        totalCost,
        runningBalance: parseFloat(running.toFixed(4)),
        cattleId: tx.cattle_id,
        sourceModule,
        notes: tx.notes,
        recordedAt: tx.recorded_at,
        createdAt: tx.created_at || tx.recorded_at,
      });
    }

    return ledger;
  }

  /**
   * Compiles the full ItemStockSummary portfolio across all inventory items.
   */
  public static compileInventoryPortfolio(
    items: RawInventoryItemRow[],
    transactions: RawInventoryTxnRow[],
    reservationsMap: Record<string, number> = {}
  ): ItemStockSummary[] {
    // Group transactions by item_id
    const txByItem = new Map<string, RawInventoryTxnRow[]>();
    for (const tx of transactions) {
      if (!txByItem.has(tx.item_id)) {
        txByItem.set(tx.item_id, []);
      }
      txByItem.get(tx.item_id)!.push(tx);
    }

    return items.map((item) => {
      const txs = txByItem.get(item.id) || [];
      const purchases = txs.filter((t) => this.getDirection(t.type) === "IN");
      const consumptions = txs.filter((t) => this.getDirection(t.type) === "OUT");

      const totalIn = purchases.reduce((s, t) => s + (t.qty || 0), 0);
      const totalOut = consumptions.reduce((s, t) => s + (t.qty || 0), 0);
      const currentStock = Math.max(0, totalIn - totalOut);
      const reservedStock = reservationsMap[item.id] || 0;
      const availableStock = Math.max(0, currentStock - reservedStock);

      // Latest purchase info
      const latestPurchase = purchases.sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      )[0];

      // Valuation (Weighted Average from active stock)
      const totalPurchasedCost = purchases.reduce((s, p) => s + p.qty * (p.unit_cost || 0), 0);
      const avgCost = totalIn > 0 ? totalPurchasedCost / totalIn : null;
      const totalValuation = avgCost != null ? currentStock * avgCost : 0;

      const isLowStock =
        item.low_stock_threshold != null &&
        item.low_stock_threshold > 0 &&
        currentStock <= item.low_stock_threshold;

      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        totalIn: parseFloat(totalIn.toFixed(3)),
        totalOut: parseFloat(totalOut.toFixed(3)),
        currentStock: parseFloat(currentStock.toFixed(3)),
        reservedStock: parseFloat(reservedStock.toFixed(3)),
        availableStock: parseFloat(availableStock.toFixed(3)),
        averageUnitCost: avgCost != null ? parseFloat(avgCost.toFixed(4)) : null,
        totalValuation: parseFloat(totalValuation.toFixed(2)),
        lowStockThreshold: item.low_stock_threshold,
        isLowStock,
        isActiveRoughage: item.is_active_roughage ?? false,
        isDiscontinued: item.is_discontinued ?? false,
        lastPurchaseDate: latestPurchase?.recorded_at ?? null,
        lastPurchasePrice: latestPurchase?.unit_cost ?? null,
      };
    });
  }

  /**
   * Pre-flight stock availability validator. Throws InsufficientStockError if not enough stock.
   */
  public static assertStockAvailability(
    itemName: string,
    requestedQty: number,
    availableQty: number,
    unit = "unit"
  ): void {
    if (requestedQty > availableQty + 0.0001) {
      throw new InsufficientStockError(itemName, requestedQty, availableQty, unit);
    }
  }
}