import { calculateDepreciation, type DepreciationInput, type DepreciationResult } from "./calculations";

export interface FixedAssetEntity {
  id: string;
  businessId: string;
  name: string;
  category: string;
  description?: string | null;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  depreciationMethod: "straight_line" | "declining_balance";
  decliningRate?: number | null;
  isActive: boolean;
  disposedAt?: string | null;
  disposalValue?: number | null;
  notes?: string | null;
}

export interface EvaluatedFixedAsset extends FixedAssetEntity {
  depreciation: DepreciationResult;
  currentBookValue: number;
  accumulatedDepreciation: number;
  monthlyDepreciation: number;
  annualDepreciation: number;
}

export class AssetEngine {
  /**
   * Evaluates the active financial state and current book value of a fixed asset
   */
  public static evaluateAsset(asset: FixedAssetEntity): EvaluatedFixedAsset {
    const depInput: DepreciationInput = {
      purchase_cost: asset.purchaseCost,
      salvage_value: asset.salvageValue,
      useful_life_years: asset.usefulLifeYears,
      depreciation_method: asset.depreciationMethod,
      declining_rate: asset.decliningRate ?? null,
      purchase_date: asset.purchaseDate,
      disposed_at: asset.disposedAt,
    };

    const dep = calculateDepreciation(depInput);

    return {
      ...asset,
      depreciation: dep,
      currentBookValue: dep.bookValue,
      accumulatedDepreciation: dep.accumulated,
      monthlyDepreciation: dep.monthly,
      annualDepreciation: dep.annual,
    };
  }

  /**
   * Aggregates total fixed asset valuation, total cost, accumulated depreciation, and net book value
   */
  public static aggregateAssetPortfolio(assets: FixedAssetEntity[]) {
    const evaluated = assets.map((a) => this.evaluateAsset(a));
    const activeAssets = evaluated.filter((a) => a.isActive && !a.disposedAt);

    const totalCost = activeAssets.reduce((s, a) => s + a.purchaseCost, 0);
    const totalAccumulatedDepreciation = activeAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
    const netBookValue = activeAssets.reduce((s, a) => s + a.currentBookValue, 0);
    const totalMonthlyDepreciation = activeAssets.reduce((s, a) => s + a.monthlyDepreciation, 0);
    const totalAnnualDepreciation = activeAssets.reduce((s, a) => s + a.annualDepreciation, 0);

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
      netBookValue: Math.round(netBookValue * 100) / 100,
      totalMonthlyDepreciation: Math.round(totalMonthlyDepreciation * 100) / 100,
      totalAnnualDepreciation: Math.round(totalAnnualDepreciation * 100) / 100,
      activeAssetCount: activeAssets.length,
      evaluatedAssets: evaluated,
    };
  }
}