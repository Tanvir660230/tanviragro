import type { Cattle, WeightLog, HealthEvent, InventoryItem, Partner, CostEntry, Sale, Loan, FixedAsset } from "./database";

export interface CattleSummary extends Cattle {
  latestWeight?: number | null;
  latestWeightDate?: string | null;
  adgKg?: number | null; // Average Daily Gain
  currentValuationBDT?: number;
  healthStatus?: "healthy" | "treatment" | "quarantine" | "critical";
  activeVaccinationsCount?: number;
}

export interface InventoryItemStock extends InventoryItem {
  currentStock: number;
  totalConsumed: number;
  consumedLast30d: number;
  avgDailyConsumption: number;
  daysOfInventoryLeft: number;
  isLowStock: boolean;
  fifoUnitCost?: number | null;
}

export interface CashBalanceSummary {
  balance: number;
  opening: number;
  capitalIn: number;
  capitalOut: number;
  salesTotal: number;
  cattleCost: number;
  invCost: number;
  opCost: number;
  fixedAssetCost: number;
  financingNet: number;
  accruedInterest: number;
  totalIn: number;
  totalOut: number;
}

export interface PartnerEquitySummary extends Partner {
  totalInvested: number;
  totalWithdrawn: number;
  netInvestment: number;
  effectiveSharePct: number;
  realizedProfit: number;
  unrealizedValuationShare: number;
  currentNetBalance: number;
}

export interface LivestockValuationSummary {
  activeCount: number;
  totalPurchaseCost: number;
  estimatedLiveMarketValue: number;
  unrealizedGainLoss: number;
  averageLiveWeightKg: number;
}
