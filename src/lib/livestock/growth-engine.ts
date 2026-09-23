import type { WeightRecord, GrowthMetrics } from "./types";
import { InvalidWeightLogError } from "./errors";

export class GrowthEngine {
  /**
   * Schaeffer Live-Weight Estimation Formula:
   * Weight (lbs) = (HeartGirth (inches)^2 * BodyLength (inches)) / 300
   * Converted to Kilograms (1 lb = 0.45359237 kg)
   */
  public static calculateWeightFromTape(girthCm: number, lengthCm: number): number {
    if (girthCm <= 0 || lengthCm <= 0) {
      throw new InvalidWeightLogError("Heart girth and body length must be positive numbers");
    }
    const girthInches = girthCm / 2.54;
    const lengthInches = lengthCm / 2.54;
    const weightLbs = (girthInches * girthInches * lengthInches) / 300;
    return Math.round(weightLbs * 0.45359237 * 10) / 10;
  }

  /**
   * Computes comprehensive growth metrics (ADG, Days on Feed, Gain, Projections).
   */
  public static computeGrowthMetrics(
    initialWeightKg: number,
    purchaseDate: string,
    logs: WeightRecord[],
    asOfDate: Date = new Date(),
    targetSlaughterWeightKg?: number,
    totalFeedConsumedKg?: number
  ): GrowthMetrics {
    const purchaseTime = new Date(purchaseDate + "T00:00:00").getTime();
    const asOfTime = asOfDate.getTime();
    const daysOnFeed = Math.max(1, Math.floor((asOfTime - purchaseTime) / 86_400_000));

    if (!logs || logs.length === 0) {
      // Default baseline estimation (0.8 kg/day average fattening rate in BD)
      const defaultAdg = 0.8;
      const projected = Math.min(650, initialWeightKg + daysOnFeed * defaultAdg);
      return {
        currentWeightKg: initialWeightKg,
        initialWeightKg,
        totalGainKg: 0,
        daysOnFeed,
        averageDailyGainKg: 0,
        projectedWeightKg: Math.round(projected * 10) / 10,
        targetSlaughterWeightKg,
        daysToTargetSlaughter: targetSlaughterWeightKg
          ? Math.max(0, Math.ceil((targetSlaughterWeightKg - initialWeightKg) / defaultAdg))
          : null,
      };
    }

    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    const latestLog = sortedLogs[sortedLogs.length - 1];
    const latestWeight = latestLog.weightKg;
    const latestTime = new Date(latestLog.recordedAt.slice(0, 10) + "T00:00:00").getTime();
    const daysSincePurchase = Math.max(1, Math.floor((latestTime - purchaseTime) / 86_400_000));
    const totalGain = Math.max(0, latestWeight - initialWeightKg);
    const adg = totalGain > 0 ? parseFloat((totalGain / daysSincePurchase).toFixed(3)) : 0;

    const daysSinceLastLog = Math.max(0, Math.floor((asOfTime - latestTime) / 86_400_000));
    const projected = Math.min(650, latestWeight + daysSinceLastLog * adg);

    const fcr = totalFeedConsumedKg && totalGain > 0
      ? parseFloat((totalFeedConsumedKg / totalGain).toFixed(2))
      : undefined;

    const daysToTarget = targetSlaughterWeightKg && adg > 0 && targetSlaughterWeightKg > projected
      ? Math.ceil((targetSlaughterWeightKg - projected) / adg)
      : null;

    return {
      currentWeightKg: latestWeight,
      initialWeightKg,
      totalGainKg: parseFloat(totalGain.toFixed(2)),
      daysOnFeed,
      averageDailyGainKg: adg,
      feedConversionRatio: fcr,
      projectedWeightKg: Math.round(projected * 10) / 10,
      targetSlaughterWeightKg,
      daysToTargetSlaughter: daysToTarget,
    };
  }
}