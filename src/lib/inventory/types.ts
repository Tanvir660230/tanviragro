export type StockMovementDirection = "IN" | "OUT";

export type StockTransactionType =
  | "purchase"
  | "consumption"
  | "transfer_in"
  | "transfer_out"
  | "adjustment_in"
  | "adjustment_out"
  | "waste"
  | "return"
  | "production_in"
  | "production_out";

export type CostingMethod = "FIFO" | "WEIGHTED_AVERAGE" | "MOVING_AVERAGE";

export interface StockLedgerEntry {
  id: string;
  businessId: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  unit: string;
  direction: StockMovementDirection;
  type: StockTransactionType;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  runningBalance: number;
  warehouseId?: string;
  batchNumber?: string;
  expiryDate?: string;
  referenceId?: string;
  cattleId?: string | null;
  sourceModule: "purchase" | "feed_mix" | "daily_deduction" | "manual_adjustment" | "cattle_feed" | "waste_log";
  notes?: string | null;
  userId?: string;
  recordedAt: string;
  createdAt: string;
}

export interface ItemStockSummary {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  totalIn: number;
  totalOut: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  averageUnitCost: number | null;
  totalValuation: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  isActiveRoughage: boolean;
  isDiscontinued: boolean;
  lastPurchaseDate?: string | null;
  lastPurchasePrice?: number | null;
}

export interface BatchLayer {
  batchId: string;
  batchNumber?: string;
  purchaseDate: string;
  expiryDate?: string;
  originalQty: number;
  remainingQty: number;
  unitCost: number | null;
}

export interface StockValuationBreakdown {
  itemId: string;
  itemName: string;
  unit: string;
  stockOnHand: number;
  valuationMethod: CostingMethod;
  unitCost: number;
  totalValue: number;
  activeBatches: BatchLayer[];
}

export interface UnitConversionRule {
  fromUnit: string;
  toUnit: string;
  factor: number; // toUnit = fromUnit * factor
}

export interface StockAdjustmentInput {
  itemId: string;
  adjustedQty: number;
  reason: "physical_count" | "spoilage" | "damage" | "shrinkage" | "waste" | "correction";
  recordedAt: string;
  notes?: string;
  unitCostOverride?: number;
}