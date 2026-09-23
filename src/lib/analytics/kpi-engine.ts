import type {
  FarmFinancialKPIs,
  FarmBiologicalKPIs,
  FarmInventoryKPIs,
  FarmHealthKPIs,
  FarmCommerceKPIs,
  ExecutiveFarmSummary,
  ComparisonMetrics,
} from "./types";

export interface CalculateFinancialKPIsOptions {
  totalRevenue: number;
  totalOpEx: number;
  inventoryValuation: number;
  biologicalAssetValue: number;
  totalLiabilities?: number;
  totalInvestedCapital?: number;
  cashBalance?: number;
  dailyBurnRate?: number;
  totalBiomassGainKg?: number;
  feedExpense?: number;
  priorMonthRevenue?: number;
  priorMonthOpEx?: number;
}

export interface CalculateBiologicalKPIsOptions {
  activeCattle: { purchaseWeightKg: number; currentWeightKg: number; daysOnFeed: number; lastWeighedDate?: string }[];
  totalDeceasedCount?: number;
  totalHistoricalCount?: number;
  totalFeedConsumedKg?: number;
  birthCount?: number;
  breedingAttemptsCount?: number;
  successfulBreedingsCount?: number;
  confirmedPregnanciesCount?: number;
  eligibleFemalesCount?: number;
}

export interface CalculateHealthKPIsOptions {
  totalScheduledVaccines: number;
  completedVaccines: number;
  totalTreatments?: number;
  successfulTreatments?: number;
  activeWithdrawalCount: number;
  overdueMedicalCount: number;
  quarantinedCount: number;
  activeTreatmentsCount?: number;
}

export class KpiEngine {
  /**
   * Calculates farm financial performance indicators with advanced unit economics.
   */
  public static calculateFinancialKPIs(
    arg1: CalculateFinancialKPIsOptions | number,
    totalOpEx = 0,
    inventoryValuation = 0,
    biologicalAssetValue = 0,
    totalInvestedCapital = 0
  ): FarmFinancialKPIs {
    let input: CalculateFinancialKPIsOptions;

    if (typeof arg1 === "object" && arg1 !== null) {
      input = arg1;
    } else {
      input = {
        totalRevenue: arg1,
        totalOpEx,
        inventoryValuation,
        biologicalAssetValue,
        totalInvestedCapital,
      };
    }

    const revenue = Math.max(0, input.totalRevenue || 0);
    const opEx = Math.max(0, input.totalOpEx || 0);
    const netProfit = revenue - opEx;
    const grossMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const invested = input.totalInvestedCapital || 0;
    const roi = invested > 0 ? (netProfit / invested) * 100 : 0;
    
    const inventoryVal = Math.max(0, input.inventoryValuation || 0);
    const bioVal = Math.max(0, input.biologicalAssetValue || 0);
    const liabilities = Math.max(0, input.totalLiabilities || 0);
    const totalAssets = inventoryVal + bioVal + (input.cashBalance || 0);
    const netEquity = totalAssets - liabilities;

    // Cash Runway Days
    const dailyBurn = input.dailyBurnRate && input.dailyBurnRate > 0 ? input.dailyBurnRate : (opEx > 0 ? opEx / 30 : 0);
    const cashRunwayDays = dailyBurn > 0 && input.cashBalance ? Math.round(input.cashBalance / dailyBurn) : 999;

    // Cost per kg biomass gain
    const biomassGain = Math.max(0, input.totalBiomassGainKg || 0);
    const feedExp = Math.max(0, input.feedExpense || 0);
    const costPerKgGain = biomassGain > 0 && feedExp > 0 ? parseFloat((feedExp / biomassGain).toFixed(2)) : 0;

    // Break-even price per kg
    const totalHeadGainOrWeight = biomassGain > 0 ? biomassGain : 1;
    const breakEvenPrice = biomassGain > 0 ? parseFloat((opEx / totalHeadGainOrWeight).toFixed(2)) : 0;

    // MoM Growth Rates
    let momRevenueGrowthPct: number | undefined;
    if (input.priorMonthRevenue !== undefined && input.priorMonthRevenue > 0) {
      momRevenueGrowthPct = parseFloat((((revenue - input.priorMonthRevenue) / input.priorMonthRevenue) * 100).toFixed(2));
    }

    let momExpenseGrowthPct: number | undefined;
    if (input.priorMonthOpEx !== undefined && input.priorMonthOpEx > 0) {
      momExpenseGrowthPct = parseFloat((((opEx - input.priorMonthOpEx) / input.priorMonthOpEx) * 100).toFixed(2));
    }

    return {
      totalRevenue: parseFloat(revenue.toFixed(2)),
      totalOperatingExpense: parseFloat(opEx.toFixed(2)),
      grossMarginPercent: parseFloat(grossMargin.toFixed(2)),
      netFarmProfit: parseFloat(netProfit.toFixed(2)),
      farmRoiPercent: parseFloat(roi.toFixed(2)),
      totalInventoryValuation: parseFloat(inventoryVal.toFixed(2)),
      totalBiologicalAssetValue: parseFloat(bioVal.toFixed(2)),
      totalLiabilities: parseFloat(liabilities.toFixed(2)),
      netEquity: parseFloat(netEquity.toFixed(2)),
      cashRunwayDays: Math.min(999, Math.max(0, cashRunwayDays)),
      costPerKgGain,
      breakEvenPricePerKg: breakEvenPrice,
      momRevenueGrowthPct,
      momExpenseGrowthPct,
    };
  }


  /**
   * Calculates livestock biological herd performance indicators.
   */
  public static calculateBiologicalKPIs(
    arg1: CalculateBiologicalKPIsOptions | { purchaseWeightKg: number; currentWeightKg: number; daysOnFeed: number; lastWeighedDate?: string }[],
    totalDeceasedCount = 0,
    totalHistoricalCount = 0,
    totalFeedConsumedKg = 0
  ): FarmBiologicalKPIs {
    let input: CalculateBiologicalKPIsOptions;

    if (Array.isArray(arg1)) {
      input = {
        activeCattle: arg1,
        totalDeceasedCount,
        totalHistoricalCount,
        totalFeedConsumedKg,
      };
    } else {
      input = arg1 || { activeCattle: [] };
    }

    const cattleList = input.activeCattle || [];
    const activeHeadCount = cattleList.length;
    const deceasedCount = input.totalDeceasedCount || 0;
    const historicalCount = input.totalHistoricalCount || (activeHeadCount + deceasedCount);


    if (activeHeadCount === 0) {
      return {
        activeHeadCount: 0,
        totalLiveBiomassKg: 0,
        averageWeightKg: 0,
        averageDailyGainKg: 0,
        feedConversionRatio: undefined,
        mortalityRatePercent: historicalCount > 0 ? parseFloat(((deceasedCount / historicalCount) * 100).toFixed(2)) : 0,
        birthRatePercent: 0,
        breedingSuccessRatePercent: 0,
        pregnancyRatePercent: 0,
        averageDaysOnFeed: 0,
        unweighedCattleCount: 0,
      };
    }

    let totalBiomass = 0;
    let totalGain = 0;
    let totalDof = 0;
    let unweighedCount = 0;
    const now = new Date().getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const c of cattleList) {
      totalBiomass += c.currentWeightKg || 0;
      totalGain += Math.max(0, (c.currentWeightKg || 0) - (c.purchaseWeightKg || 0));
      totalDof += c.daysOnFeed || 0;

      if (c.lastWeighedDate) {
        const weighedTime = new Date(c.lastWeighedDate).getTime();
        if (now - weighedTime > thirtyDaysMs) {
          unweighedCount++;
        }
      } else {
        unweighedCount++;
      }
    }

    const averageWeight = totalBiomass / activeHeadCount;
    const averageDof = totalDof / activeHeadCount;
    const totalDaysOnFeedSum = cattleList.reduce((sum, c) => sum + Math.max(1, c.daysOnFeed || 1), 0);
    const adg = totalDaysOnFeedSum > 0 ? totalGain / totalDaysOnFeedSum : 0;

    const mortalityRate = historicalCount > 0 ? (deceasedCount / historicalCount) * 100 : 0;
    const fcr = totalGain > 0 && input.totalFeedConsumedKg && input.totalFeedConsumedKg > 0
      ? input.totalFeedConsumedKg / totalGain
      : undefined;

    const birthRate = activeHeadCount > 0 && input.birthCount ? (input.birthCount / activeHeadCount) * 100 : 0;
    const breedingSuccess = (input.breedingAttemptsCount || 0) > 0 && input.successfulBreedingsCount
      ? (input.successfulBreedingsCount / (input.breedingAttemptsCount || 1)) * 100
      : 0;
    const pregnancyRate = (input.eligibleFemalesCount || 0) > 0 && input.confirmedPregnanciesCount
      ? (input.confirmedPregnanciesCount / (input.eligibleFemalesCount || 1)) * 100
      : 0;

    return {
      activeHeadCount,
      totalLiveBiomassKg: Math.round(totalBiomass * 10) / 10,
      averageWeightKg: Math.round(averageWeight * 10) / 10,
      averageDailyGainKg: parseFloat(adg.toFixed(3)),
      feedConversionRatio: fcr ? parseFloat(fcr.toFixed(2)) : undefined,
      mortalityRatePercent: parseFloat(mortalityRate.toFixed(2)),
      birthRatePercent: parseFloat(birthRate.toFixed(2)),
      breedingSuccessRatePercent: parseFloat(breedingSuccess.toFixed(2)),
      pregnancyRatePercent: parseFloat(pregnancyRate.toFixed(2)),
      averageDaysOnFeed: Math.round(averageDof),
      unweighedCattleCount: unweighedCount,
    };
  }

  /**
   * Calculates farm inventory and feed consumption indicators.
   */
  public static calculateInventoryKPIs(
    items: { currentStock: number; lowStockThreshold: number; unitCost: number; isOutOfStock?: boolean; costOfGoodsIssued?: number }[],
    dailyFeedIntakeKg = 0,
    dailyFeedCostBdt = 0
  ): FarmInventoryKPIs {
    let totalValuation = 0;
    let lowStockCount = 0;
    let criticalStockOutCount = 0;
    let totalCOGS = 0;

    for (const item of items) {
      const stock = Math.max(0, item.currentStock || 0);
      const unitCost = item.unitCost || 0;
      totalValuation += stock * unitCost;
      totalCOGS += item.costOfGoodsIssued || 0;

      if (item.isOutOfStock || stock <= 0) {
        criticalStockOutCount++;
        lowStockCount++;
      } else if (stock <= item.lowStockThreshold) {
        lowStockCount++;
      }
    }

    const inventoryTurnoverRatio = totalValuation > 0 && totalCOGS > 0 ? parseFloat((totalCOGS / totalValuation).toFixed(2)) : 0;
    const feedStockRunwayDays = dailyFeedCostBdt > 0 && totalValuation > 0 ? Math.round(totalValuation / dailyFeedCostBdt) : 99;

    return {
      totalStockValuation: parseFloat(totalValuation.toFixed(2)),
      lowStockItemsCount: lowStockCount,
      criticalStockOutCount,
      dailyFeedRunRateKg: parseFloat(dailyFeedIntakeKg.toFixed(2)),
      dailyFeedCostBdt: parseFloat(dailyFeedCostBdt.toFixed(2)),
      inventoryTurnoverRatio,
      feedStockRunwayDays: Math.min(365, Math.max(0, feedStockRunwayDays)),
    };
  }

  /**
   * Calculates veterinary and health compliance indicators.
   */
  public static calculateHealthKPIs(
    arg1: CalculateHealthKPIsOptions | number,
    completedVaccines = 0,
    activeWithdrawalCount = 0,
    overdueMedicalCount = 0,
    quarantinedCount = 0
  ): FarmHealthKPIs {
    let input: CalculateHealthKPIsOptions;

    if (typeof arg1 === "object" && arg1 !== null) {
      input = arg1;
    } else {
      input = {
        totalScheduledVaccines: arg1,
        completedVaccines,
        activeWithdrawalCount,
        overdueMedicalCount,
        quarantinedCount,
      };
    }

    const complianceRate =
      input.totalScheduledVaccines > 0
        ? (input.completedVaccines / input.totalScheduledVaccines) * 100
        : 100;

    const treatmentSuccessRate =
      (input.totalTreatments || 0) > 0 && input.successfulTreatments
        ? (input.successfulTreatments / (input.totalTreatments || 1)) * 100
        : 100;

    return {
      vaccinationComplianceRate: parseFloat(complianceRate.toFixed(1)),
      treatmentSuccessRate: parseFloat(treatmentSuccessRate.toFixed(1)),
      activeWithdrawalCount: input.activeWithdrawalCount,
      overdueMedicalEventsCount: input.overdueMedicalCount,
      quarantinedCount: input.quarantinedCount,
      activeTreatmentsCount: input.activeTreatmentsCount || 0,
    };
  }

  /**
   * Calculates livestock commerce & sales performance indicators.
   */
  public static calculateCommerceKPIs(input: {
    totalOrders: number;
    totalGrossSalesBdt: number;
    qurbaniBookingsCount?: number;
    pendingDeliveriesCount?: number;
    totalCustomersCount?: number;
    repeatCustomersCount?: number;
  }): FarmCommerceKPIs {
    const totalOrders = Math.max(0, input.totalOrders || 0);
    const grossSales = Math.max(0, input.totalGrossSalesBdt || 0);
    const avgOrderValue = totalOrders > 0 ? grossSales / totalOrders : 0;
    const totalCust = input.totalCustomersCount || 0;
    const repeatCust = input.repeatCustomersCount || 0;
    const repeatRate = totalCust > 0 ? (repeatCust / totalCust) * 100 : 0;

    return {
      totalOrdersCount: totalOrders,
      totalGrossSalesBdt: parseFloat(grossSales.toFixed(2)),
      averageOrderValueBdt: parseFloat(avgOrderValue.toFixed(2)),
      qurbaniBookingsCount: input.qurbaniBookingsCount || 0,
      pendingDeliveriesCount: input.pendingDeliveriesCount || 0,
      repeatCustomerRatePct: parseFloat(repeatRate.toFixed(2)),
    };
  }

  /**
   * Evaluates comparison and trends between two scalar metrics.
   */
  public static calculateComparison(
    currentValue: number,
    previousValue: number,
    higherIsBetter = true
  ): ComparisonMetrics {
    const changeValue = currentValue - previousValue;
    const changePercent = previousValue !== 0 ? (changeValue / Math.abs(previousValue)) * 100 : 0;
    
    let trend: "up" | "down" | "flat" = "flat";
    if (changeValue > 0.001) trend = "up";
    else if (changeValue < -0.001) trend = "down";

    const isFavorable = higherIsBetter ? changeValue >= 0 : changeValue <= 0;

    return {
      currentValue: parseFloat(currentValue.toFixed(2)),
      previousValue: parseFloat(previousValue.toFixed(2)),
      changeValue: parseFloat(changeValue.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      trend,
      isFavorable,
    };
  }
}