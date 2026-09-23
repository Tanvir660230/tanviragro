import type { StockAdjustmentInput, StockMovementDirection } from "./types";
import { CostingEngine } from "./costing-engine";

export interface AdjustmentResult {
  direction: StockMovementDirection;
  adjustmentQty: number;
  delta: number;
  unitCost: number | null;
  totalCost: number | null;
  transactionType: "purchase" | "consumption";
  notes: string;
}

/**
 * Enterprise Stock Adjustment Engine
 * Computes exact reconciliation deltas for physical audits, spoilage, shrinkage, and damage.
 */
export class AdjustmentEngine {
  /**
   * Prepares the transaction delta for a physical stock count or manual correction.
   */
  public static processAdjustment(
    input: StockAdjustmentInput,
    currentStockOnHand: number,
    estimatedUnitCost: number | null
  ): AdjustmentResult {
    const delta = input.adjustedQty - currentStockOnHand;
    const absQty = Math.abs(delta);

    // If new count > current on hand -> INFLOW ("purchase" entry with unit cost)
    // If new count < current on hand -> OUTFLOW ("consumption" entry with FIFO cost)
    const direction: StockMovementDirection = delta >= 0 ? "IN" : "OUT";
    const transactionType = direction === "IN" ? ("purchase" as const) : ("consumption" as const);

    const unitCost = input.unitCostOverride !== undefined ? input.unitCostOverride : estimatedUnitCost;
    const totalCost = unitCost != null ? parseFloat((absQty * unitCost).toFixed(2)) : null;

    const reasonLabelMap = {
      physical_count: "Physical Count Reconciliation",
      spoilage: "Spoilage / Rotting Loss",
      damage: "Damaged Stock Write-off",
      shrinkage: "Moisture Loss / Shrinkage",
      waste: "Operational Waste",
      correction: "Inventory Balance Correction",
    };

    const notes = `Stock Adjustment (${reasonLabelMap[input.reason]}): Old ${currentStockOnHand} -> New ${input.adjustedQty} (Delta: ${delta > 0 ? "+" : ""}${delta})${input.notes ? ` | Notes: ${input.notes}` : ""}`;

    return {
      direction,
      adjustmentQty: absQty,
      delta,
      unitCost,
      totalCost,
      transactionType,
      notes,
    };
  }
}