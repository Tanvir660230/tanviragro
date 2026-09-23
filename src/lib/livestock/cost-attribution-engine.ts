import type { AnimalCostSummary } from "./types";

export interface DirectCostEntry {
  cattleId: string;
  category: "feed" | "medicine" | "treatment" | "other";
  amount: number;
}

export class CostAttributionEngine {
  /**
   * Compiles total accumulated cost per animal.
   */
  public static calculateAnimalCost(
    cattleId: string,
    purchasePrice: number,
    currentLiveWeightKg: number,
    directCosts: DirectCostEntry[],
    allocatedOverheadShare = 0
  ): AnimalCostSummary {
    let directFeedCost = 0;
    let directMedicineCost = 0;
    let otherDirectCost = 0;

    for (const cost of directCosts) {
      if (cost.category === "feed") directFeedCost += cost.amount;
      else if (cost.category === "medicine" || cost.category === "treatment") directMedicineCost += cost.amount;
      else otherDirectCost += cost.amount;
    }

    const totalAccumulatedCost =
      purchasePrice + directFeedCost + directMedicineCost + otherDirectCost + allocatedOverheadShare;

    const costPerKgLiveWeight =
      currentLiveWeightKg > 0
        ? parseFloat((totalAccumulatedCost / currentLiveWeightKg).toFixed(2))
        : 0;

    return {
      cattleId,
      purchaseCost: purchasePrice,
      directFeedCost: parseFloat(directFeedCost.toFixed(2)),
      directMedicineCost: parseFloat(directMedicineCost.toFixed(2)),
      allocatedOverheadCost: parseFloat(allocatedOverheadShare.toFixed(2)),
      totalAccumulatedCost: parseFloat(totalAccumulatedCost.toFixed(2)),
      costPerKgLiveWeight,
      projectedBreakEvenSalePrice: parseFloat(totalAccumulatedCost.toFixed(2)),
    };
  }

  /**
   * Pro-rates farm-wide general overhead costs (labor, utility, facility) equally across active head count.
   */
  public static allocateOverheadPerHead(
    totalFarmOverhead: number,
    activeHeadCount: number
  ): number {
    if (activeHeadCount <= 0 || totalFarmOverhead <= 0) return 0;
    return parseFloat((totalFarmOverhead / activeHeadCount).toFixed(2));
  }
}