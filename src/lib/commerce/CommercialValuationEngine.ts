import type { CommercialProfitLossSummary } from "./types";

export interface BatchValuationSummary {
  totalAnimals: number;
  totalPurchaseCost: number;
  totalFeedCost: number;
  totalMedicalCost: number;
  totalLogisticsCost: number;
  totalCostBasis: number;
  totalRealizedRevenue: number;
  totalNetProfitBdt: number;
  overallNetMarginPct: number;
  averageHoldingDays: number;
  averageAnnualizedRoi: number;
}

export class CommercialValuationEngine {
  /**
   * Computes per-animal commercial P&L and ROI
   */
  public static calculateAnimalProfitLoss(params: {
    cattleId: string;
    tagId: string;
    purchasePrice: number;
    purchaseDateISO: string;
    soldDateISO?: string | null;
    salePrice: number;
    feedCost?: number;
    medicalCost?: number;
    logisticsCost?: number;
  }): CommercialProfitLossSummary {
    const purchase = Number(params.purchasePrice) || 0;
    const feed = Number(params.feedCost) || 0;
    const medical = Number(params.medicalCost) || 0;
    const logistics = Number(params.logisticsCost) || 0;
    const sale = Number(params.salePrice) || 0;

    const totalCostBasis = Math.round((purchase + feed + medical + logistics) * 100) / 100;
    const grossMarginBdt = Math.round((sale - totalCostBasis) * 100) / 100;

    const netMarginPercentage =
      sale > 0 ? Math.round(((sale - totalCostBasis) / sale) * 10000) / 100 : 0;

    const startMs = new Date(params.purchaseDateISO).getTime();
    const endMs = params.soldDateISO
      ? new Date(params.soldDateISO).getTime()
      : new Date().getTime();
    const holdingDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    // Annualized ROI: (Gross Margin / Total Cost Basis) * (365 / Holding Days) * 100
    const rawRoi = totalCostBasis > 0 ? (grossMarginBdt / totalCostBasis) * (365 / holdingDays) * 100 : 0;
    const annualizedRoi = Math.round(rawRoi * 100) / 100;

    return {
      cattleId: params.cattleId,
      tagId: params.tagId,
      purchasePrice: purchase,
      feedCost: feed,
      medicalCost: medical,
      logisticsCost: logistics,
      totalCostBasis,
      salePrice: sale,
      grossMarginBdt,
      netMarginPercentage,
      holdingDays,
      annualizedRoi,
    };
  }

  /**
   * Aggregates commercial metrics across multiple animals / lots
   */
  public static aggregateBatchValuation(
    summaries: CommercialProfitLossSummary[]
  ): BatchValuationSummary {
    if (summaries.length === 0) {
      return {
        totalAnimals: 0,
        totalPurchaseCost: 0,
        totalFeedCost: 0,
        totalMedicalCost: 0,
        totalLogisticsCost: 0,
        totalCostBasis: 0,
        totalRealizedRevenue: 0,
        totalNetProfitBdt: 0,
        overallNetMarginPct: 0,
        averageHoldingDays: 0,
        averageAnnualizedRoi: 0,
      };
    }

    let purchase = 0;
    let feed = 0;
    let medical = 0;
    let logistics = 0;
    let costBasis = 0;
    let revenue = 0;
    let profit = 0;
    let totalDays = 0;
    let totalRoi = 0;

    for (const s of summaries) {
      purchase += s.purchasePrice;
      feed += s.feedCost;
      medical += s.medicalCost;
      logistics += s.logisticsCost;
      costBasis += s.totalCostBasis;
      revenue += s.salePrice;
      profit += s.grossMarginBdt;
      totalDays += s.holdingDays;
      totalRoi += s.annualizedRoi;
    }

    const count = summaries.length;
    const overallMargin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

    return {
      totalAnimals: count,
      totalPurchaseCost: Math.round(purchase * 100) / 100,
      totalFeedCost: Math.round(feed * 100) / 100,
      totalMedicalCost: Math.round(medical * 100) / 100,
      totalLogisticsCost: Math.round(logistics * 100) / 100,
      totalCostBasis: Math.round(costBasis * 100) / 100,
      totalRealizedRevenue: Math.round(revenue * 100) / 100,
      totalNetProfitBdt: Math.round(profit * 100) / 100,
      overallNetMarginPct: overallMargin,
      averageHoldingDays: Math.round(totalDays / count),
      averageAnnualizedRoi: Math.round((totalRoi / count) * 100) / 100,
    };
  }

  /**
   * Estimates market fair valuation based on live weight and benchmark liveweight price
   */
  public static estimateMarketValue(
    weightKg: number,
    benchmarkRatePerKg: number = 450,
    breedPremiumMultiplier: number = 1.0
  ): number {
    if (weightKg <= 0 || benchmarkRatePerKg <= 0) return 0;
    const baseValuation = weightKg * benchmarkRatePerKg;
    return Math.round(baseValuation * breedPremiumMultiplier);
  }
}
