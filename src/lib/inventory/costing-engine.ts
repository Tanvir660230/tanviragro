import type { BatchLayer, CostingMethod, StockValuationBreakdown } from "./types";
import { CostCalculationError } from "./errors";

export interface CostingTransactionInput {
  id: string;
  itemId: string;
  type: "purchase" | "consumption";
  qty: number;
  unitCost: number | null;
  recordedAt: string;
}

/**
 * Enterprise Inventory Costing & Valuation Engine
 * Authoritative single source of truth for FIFO layering, weighted averages, and landed cost.
 */
export class CostingEngine {
  /**
   * Computes the exact FIFO unit cost for consuming `consumeQty` of an item,
   * properly exhausting past purchase batches without mutating original inputs.
   */
  public static computeFIFOCost(
    purchases: { qty: number; unitCost: number | null; recordedAt: string }[],
    totalPreviouslyConsumed: number,
    consumeQty: number
  ): number | null {
    if (!purchases || purchases.length === 0 || consumeQty <= 0) {
      return null;
    }

    // Sort chronologically (oldest purchase first)
    const sortedBatches = [...purchases]
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((p) => ({
        qty: Math.max(0, p.qty),
        unitCost: p.unitCost,
      }));

    // Burn off previously consumed quantity from the oldest batches
    let burnRemaining = totalPreviouslyConsumed;
    for (const b of sortedBatches) {
      if (burnRemaining <= 0) break;
      const take = Math.min(burnRemaining, b.qty);
      b.qty -= take;
      burnRemaining -= take;
    }

    // Compute cost for the current consumption quantity
    let totalCost = 0;
    let coveredQty = 0;
    let leftToConsume = consumeQty;

    for (const b of sortedBatches) {
      if (leftToConsume <= 0) break;
      if (b.qty <= 0) continue;

      const take = Math.min(leftToConsume, b.qty);
      if (b.unitCost != null && b.unitCost >= 0) {
        totalCost += take * b.unitCost;
      }
      coveredQty += take;
      leftToConsume -= take;
    }

    if (coveredQty === 0) return null;
    return parseFloat((totalCost / consumeQty).toFixed(4));
  }

  /**
   * Distributes Landed Costs (freight, transport, loading) across raw purchase line items.
   * Pro-rated by item total value (or evenly if value is zero).
   */
  public static distributeLandedCost(
    items: { itemId: string; qty: number; itemTotalCost: number }[],
    transportCost = 0
  ): { itemId: string; qty: number; rawCost: number; landedTotalCost: number; unitCost: number }[] {
    const rawTotal = items.reduce((s, it) => s + Math.max(0, it.itemTotalCost || 0), 0);
    const validTransport = Math.max(0, transportCost || 0);

    return items.map((it) => {
      let allocatedTransport = 0;
      if (rawTotal > 0 && validTransport > 0) {
        allocatedTransport = validTransport * ((it.itemTotalCost || 0) / rawTotal);
      } else if (rawTotal === 0 && validTransport > 0 && items.length > 0) {
        allocatedTransport = validTransport / items.length;
      }

      const landedTotalCost = (it.itemTotalCost || 0) + allocatedTransport;
      const unitCost = it.qty > 0 ? parseFloat((landedTotalCost / it.qty).toFixed(4)) : 0;

      return {
        itemId: it.itemId,
        qty: it.qty,
        rawCost: it.itemTotalCost || 0,
        landedTotalCost: parseFloat(landedTotalCost.toFixed(2)),
        unitCost,
      };
    });
  }

  /**
   * Builds active FIFO remaining layers and computes total balance valuation.
   */
  public static calculateInventoryValuation(
    itemId: string,
    itemName: string,
    unit: string,
    transactions: CostingTransactionInput[],
    method: CostingMethod = "FIFO"
  ): StockValuationBreakdown {
    const purchases = transactions
      .filter((t) => t.type === "purchase")
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    const totalConsumed = transactions
      .filter((t) => t.type === "consumption")
      .reduce((sum, t) => sum + (t.qty || 0), 0);

    const totalPurchased = purchases.reduce((sum, t) => sum + (t.qty || 0), 0);
    const stockOnHand = totalPurchased - totalConsumed;   // signed: never hide a negative balance

    // Build remaining active batch layers
    let burn = totalConsumed;
    const activeBatches: BatchLayer[] = [];

    for (const p of purchases) {
      const takeBurn = Math.min(burn, p.qty);
      burn -= takeBurn;
      const remaining = p.qty - takeBurn;

      if (remaining > 0) {
        activeBatches.push({
          batchId: p.id,
          purchaseDate: p.recordedAt,
          originalQty: p.qty,
          remainingQty: remaining,
          unitCost: p.unitCost,
        });
      }
    }

    let totalValue = 0;
    if (method === "FIFO") {
      totalValue = activeBatches.reduce((acc, b) => acc + b.remainingQty * (b.unitCost || 0), 0);
    } else {
      // Weighted Average
      const totalPurchasedCost = purchases.reduce((s, p) => s + p.qty * (p.unitCost || 0), 0);
      const avgUnitCost = totalPurchased > 0 ? totalPurchasedCost / totalPurchased : 0;
      totalValue = stockOnHand * avgUnitCost;
    }

    const unitCost = stockOnHand > 0 ? parseFloat((totalValue / stockOnHand).toFixed(4)) : 0;

    return {
      itemId,
      itemName,
      unit,
      stockOnHand: parseFloat(stockOnHand.toFixed(3)),
      valuationMethod: method,
      unitCost,
      totalValue: parseFloat(totalValue.toFixed(2)),
      activeBatches,
    };
  }
}