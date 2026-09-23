import type { AnimalFinancialLedger, AnimalFinancialStatus } from "./types";

export interface AnimalProfitabilityInput {
  cattleId: string;
  businessId: string;
  tagId?: string | null;
  costCenterId?: string | null;
  purchaseCost: number;
  purchaseWeightKg?: number;
  currentWeightKg?: number;
  finalWeightKg?: number;
  feedCost?: number;
  medicineCost?: number;
  vaccineCost?: number;
  laborAllocated?: number;
  breedingCost?: number;
  transportCost?: number;
  overheadAllocated?: number;
  insuranceCost?: number;
  mortalityLoss?: number;
  saleRevenue?: number;
  currentBiologicalValue?: number;
  status?: AnimalFinancialStatus;
}

export interface FarmProfitabilitySummary {
  farmId: string;
  farmName: string;
  totalHeadCount: number;
  activeHeadCount: number;
  soldHeadCount: number;
  totalPurchaseCost: number;
  totalFeedCost: number;
  totalMedicalCost: number;
  totalOverheadLaborCost: number;
  totalAccumulatedCost: number;
  totalSaleRevenue: number;
  totalNetProfit: number;
  averageNetMarginPct: number;
  averageCostPerKgGain: number;
  totalWeightGainKg: number;
  totalROI: number;
  estimatedBiologicalValue: number;
}

export interface BreedProfitabilitySummary {
  breed: string;
  headCount: number;
  averageWeightGainKg: number;
  averageFeedCost: number;
  averageCostPerKgGain: number;
  averageSaleRevenue: number;
  averageNetProfit: number;
  averageROIPct: number;
  totalNetProfit: number;
}
export class LivestockProfitabilityEngine {
  /**
   * Computes comprehensive unit economics and lifetime financial ledger for a single animal.
   */
  public static calculateAnimalUnitEconomics(input: AnimalProfitabilityInput): AnimalFinancialLedger {
    const purchaseCost = Math.max(0, Number(input.purchaseCost) || 0);
    const feedCost = Math.max(0, Number(input.feedCost) || 0);
    const medicineCost = Math.max(0, Number(input.medicineCost) || 0);
    const vaccineCost = Math.max(0, Number(input.vaccineCost) || 0);
    const laborAllocated = Math.max(0, Number(input.laborAllocated) || 0);
    const breedingCost = Math.max(0, Number(input.breedingCost) || 0);
    const transportCost = Math.max(0, Number(input.transportCost) || 0);
    const overheadAllocated = Math.max(0, Number(input.overheadAllocated) || 0);
    const insuranceCost = Math.max(0, Number(input.insuranceCost) || 0);
    const mortalityLoss = Math.max(0, Number(input.mortalityLoss) || 0);
    const saleRevenue = Math.max(0, Number(input.saleRevenue) || 0);

    const directGrowingCosts = feedCost + medicineCost + vaccineCost + laborAllocated + breedingCost + transportCost + overheadAllocated + insuranceCost;
    const totalAccumulatedCost = Math.round((purchaseCost + directGrowingCosts + mortalityLoss) * 100) / 100;

    const netProfit = Math.round((saleRevenue - totalAccumulatedCost) * 100) / 100;

    const grossMarginPct = saleRevenue > 0
      ? Math.round(((saleRevenue - purchaseCost) / saleRevenue) * 10000) / 100
      : 0;

    const netMarginPct = saleRevenue > 0
      ? Math.round((netProfit / saleRevenue) * 10000) / 100
      : 0;

    const startWeight = Math.max(0, Number(input.purchaseWeightKg) || 0);
    const endWeight = Math.max(0, Number(input.finalWeightKg || input.currentWeightKg) || 0);
    const weightGainKg = Math.round(Math.max(0, endWeight - startWeight) * 100) / 100;

    const costPerKgGain = weightGainKg > 0
      ? Math.round((directGrowingCosts / weightGainKg) * 100) / 100
      : 0;

    const roiPct = totalAccumulatedCost > 0
      ? Math.round((netProfit / totalAccumulatedCost) * 10000) / 100
      : 0;

    const currentBioVal = input.currentBiologicalValue !== undefined
      ? input.currentBiologicalValue
      : (saleRevenue > 0 ? saleRevenue : totalAccumulatedCost);

    const lifetimeValue = Math.round(Math.max(saleRevenue, currentBioVal) * 100) / 100;

    return {
      id: `afl-${input.cattleId}`,
      businessId: input.businessId,
      cattleId: input.cattleId,
      tagId: input.tagId,
      costCenterId: input.costCenterId,
      purchaseCost,
      feedCost,
      medicineCost,
      vaccineCost,
      laborAllocated,
      breedingCost,
      transportCost,
      overheadAllocated,
      insuranceCost,
      mortalityLoss,
      totalAccumulatedCost,
      saleRevenue,
      netProfit,
      grossMarginPct,
      netMarginPct,
      weightGainKg,
      costPerKgGain,
      currentBiologicalValue: Math.round(currentBioVal * 100) / 100,
      lastValuationDate: new Date().toISOString().slice(0, 10),
      roiPct,
      lifetimeValue,
      status: input.status || (saleRevenue > 0 ? "sold" : "active"),
      updatedAt: new Date().toISOString(),
    };
  }
  /**
   * Aggregates profitability by Farm / Location.
   */
  public static aggregateFarmProfitability(
    farmId: string,
    farmName: string,
    ledgers: AnimalFinancialLedger[]
  ): FarmProfitabilitySummary {
    const totalHeadCount = ledgers.length;
    if (totalHeadCount === 0) {
      return {
        farmId,
        farmName,
        totalHeadCount: 0,
        activeHeadCount: 0,
        soldHeadCount: 0,
        totalPurchaseCost: 0,
        totalFeedCost: 0,
        totalMedicalCost: 0,
        totalOverheadLaborCost: 0,
        totalAccumulatedCost: 0,
        totalSaleRevenue: 0,
        totalNetProfit: 0,
        averageNetMarginPct: 0,
        averageCostPerKgGain: 0,
        totalWeightGainKg: 0,
        totalROI: 0,
        estimatedBiologicalValue: 0,
      };
    }

    let activeCount = 0;
    let soldCount = 0;
    let totalPurchase = 0;
    let totalFeed = 0;
    let totalMed = 0;
    let totalOverheadLabor = 0;
    let totalCost = 0;
    let totalRev = 0;
    let totalProfit = 0;
    let totalWeightGain = 0;
    let totalBiologicalVal = 0;
    let totalGrowingCosts = 0;

    for (const l of ledgers) {
      if (l.status === "sold") soldCount++;
      else if (l.status === "active") activeCount++;

      totalPurchase += l.purchaseCost;
      totalFeed += l.feedCost;
      totalMed += (l.medicineCost + l.vaccineCost);
      totalOverheadLabor += (l.laborAllocated + l.overheadAllocated + l.transportCost + l.breedingCost);
      totalCost += l.totalAccumulatedCost;
      totalRev += l.saleRevenue;
      totalProfit += l.netProfit;
      totalWeightGain += l.weightGainKg;
      totalBiologicalVal += l.currentBiologicalValue;
      totalGrowingCosts += (l.feedCost + l.medicineCost + l.vaccineCost + l.laborAllocated + l.overheadAllocated);
    }

    const avgNetMargin = totalRev > 0 ? Math.round((totalProfit / totalRev) * 10000) / 100 : 0;
    const avgCostPerKgGain = totalWeightGain > 0 ? Math.round((totalGrowingCosts / totalWeightGain) * 100) / 100 : 0;
    const totalROI = totalCost > 0 ? Math.round((totalProfit / totalCost) * 10000) / 100 : 0;

    return {
      farmId,
      farmName,
      totalHeadCount,
      activeHeadCount: activeCount,
      soldHeadCount: soldCount,
      totalPurchaseCost: Math.round(totalPurchase * 100) / 100,
      totalFeedCost: Math.round(totalFeed * 100) / 100,
      totalMedicalCost: Math.round(totalMed * 100) / 100,
      totalOverheadLaborCost: Math.round(totalOverheadLabor * 100) / 100,
      totalAccumulatedCost: Math.round(totalCost * 100) / 100,
      totalSaleRevenue: Math.round(totalRev * 100) / 100,
      totalNetProfit: Math.round(totalProfit * 100) / 100,
      averageNetMarginPct: avgNetMargin,
      averageCostPerKgGain: avgCostPerKgGain,
      totalWeightGainKg: Math.round(totalWeightGain * 100) / 100,
      totalROI,
      estimatedBiologicalValue: Math.round(totalBiologicalVal * 100) / 100,
    };
  }

  /**
   * Aggregates profitability by Cattle Breed to identify most profitable genetics.
   */
  public static aggregateBreedProfitability(
    breedGroups: { breed: string; ledgers: AnimalFinancialLedger[] }[]
  ): BreedProfitabilitySummary[] {
    return breedGroups.map(({ breed, ledgers }) => {
      const count = ledgers.length;
      if (count === 0) {
        return {
          breed,
          headCount: 0,
          averageWeightGainKg: 0,
          averageFeedCost: 0,
          averageCostPerKgGain: 0,
          averageSaleRevenue: 0,
          averageNetProfit: 0,
          averageROIPct: 0,
          totalNetProfit: 0,
        };
      }

      let sumGain = 0;
      let sumFeed = 0;
      let sumRev = 0;
      let sumProfit = 0;
      let sumCost = 0;
      let sumGrowingCosts = 0;

      for (const l of ledgers) {
        sumGain += l.weightGainKg;
        sumFeed += l.feedCost;
        sumRev += l.saleRevenue;
        sumProfit += l.netProfit;
        sumCost += l.totalAccumulatedCost;
        sumGrowingCosts += (l.feedCost + l.medicineCost + l.vaccineCost + l.laborAllocated + l.overheadAllocated);
      }

      return {
        breed,
        headCount: count,
        averageWeightGainKg: Math.round((sumGain / count) * 100) / 100,
        averageFeedCost: Math.round((sumFeed / count) * 100) / 100,
        averageCostPerKgGain: sumGain > 0 ? Math.round((sumGrowingCosts / sumGain) * 100) / 100 : 0,
        averageSaleRevenue: Math.round((sumRev / count) * 100) / 100,
        averageNetProfit: Math.round((sumProfit / count) * 100) / 100,
        averageROIPct: sumCost > 0 ? Math.round((sumProfit / sumCost) * 10000) / 100 : 0,
        totalNetProfit: Math.round(sumProfit * 100) / 100,
      };
    });
  }
}

