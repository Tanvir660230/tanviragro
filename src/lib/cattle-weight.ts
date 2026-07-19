/**
 * Smart per-cattle weight prediction.
 *
 * Strategy:
 *  1. If the cattle has weight logs, compute its own actual daily gain rate
 *     (latest_weight - initial_weight) / days_since_purchase.
 *  2. Predict current weight = latest_weight + (days_since_last_log × own_rate).
 *  3. If no weight logs exist, fall back to: initial_weight + days × default_rate.
 *
 * As more weight logs are recorded, the per-cattle rate becomes more accurate.
 */

export interface WeightLogEntry {
  cattle_id: string;
  weight_kg: number;
  recorded_at: string; // ISO date string
}

export interface CattleWeightInfo {
  cattleId: string;
  initialWeightKg: number;
  purchaseDate: string; // YYYY-MM-DD
  defaultDailyGainKg: number;
}

export interface WeightPrediction {
  predictedWeight: number;
  source: "weighed+predicted" | "weighed" | "estimated";
  lastLoggedWeight: number | null;
  lastLogDate: string | null;
  actualDailyGainRate: number | null; // kg/day based on own history
  daysSinceLastLog: number | null;
}

/**
 * Compute the predicted current weight for a single cattle.
 * @param cattle  Basic cattle info
 * @param logs    All weight logs for this cattle, any order
 * @param asOf    Date to predict for (defaults to today)
 */
export function predictWeight(
  cattle: CattleWeightInfo,
  logs: WeightLogEntry[],
  asOf: Date = new Date()
): WeightPrediction {
  const purchaseDate = new Date(cattle.purchaseDate + "T00:00:00");
  const daysInPen    = Math.max(0, Math.floor((asOf.getTime() - purchaseDate.getTime()) / 86_400_000));

  if (logs.length === 0) {
    // No logs at all — use default rate
    return {
      predictedWeight:    Math.min(650, cattle.initialWeightKg + daysInPen * cattle.defaultDailyGainKg),
      source:             "estimated",
      lastLoggedWeight:   null,
      lastLogDate:        null,
      actualDailyGainRate: null,
      daysSinceLastLog:   null,
    };
  }

  // Sort logs oldest → newest
  const sorted = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const latest    = sorted[sorted.length - 1];
  const latestWt  = latest.weight_kg;
  const latestDate = new Date(latest.recorded_at.slice(0, 10) + "T00:00:00");
  const daysSinceLastLog = Math.max(0, Math.floor((asOf.getTime() - latestDate.getTime()) / 86_400_000));

  // Compute actual gain rate from full history
  const daysSincePurchase = Math.max(1, Math.floor((latestDate.getTime() - purchaseDate.getTime()) / 86_400_000));
  const totalGain = latestWt - cattle.initialWeightKg;
  // If the cattle hasn't gained (or lost weight), hold the projection flat at the
  // last logged weight rather than assuming the default growth rate — substituting
  // a positive default here would silently mask real weight loss and overstate
  // the cattle's projected/market value.
  const actualRate = totalGain > 0
    ? totalGain / daysSincePurchase
    : 0;

  if (daysSinceLastLog === 0) {
    // Weighed today — no prediction needed
    return {
      predictedWeight:    latestWt,
      source:             "weighed",
      lastLoggedWeight:   latestWt,
      lastLogDate:        latest.recorded_at.slice(0, 10),
      actualDailyGainRate: actualRate,
      daysSinceLastLog:   0,
    };
  }

  // Predict forward from last log using own rate; cap at biological ceiling
  const predicted = Math.min(650, latestWt + daysSinceLastLog * actualRate);

  return {
    predictedWeight:    Math.round(predicted * 10) / 10,
    source:             "weighed+predicted",
    lastLoggedWeight:   latestWt,
    lastLogDate:        latest.recorded_at.slice(0, 10),
    actualDailyGainRate: actualRate,
    daysSinceLastLog,
  };
}

/**
 * Build a map of cattleId → WeightPrediction for all active cattle.
 */
export function buildWeightPredictions(
  activeCattle: CattleWeightInfo[],
  allLogs: WeightLogEntry[],
  asOf: Date = new Date()
): Record<string, WeightPrediction> {
  // Group logs by cattle_id
  const logsByCattle: Record<string, WeightLogEntry[]> = {};
  for (const log of allLogs) {
    if (!logsByCattle[log.cattle_id]) logsByCattle[log.cattle_id] = [];
    logsByCattle[log.cattle_id].push(log);
  }

  const result: Record<string, WeightPrediction> = {};
  for (const cattle of activeCattle) {
    result[cattle.cattleId] = predictWeight(
      cattle,
      logsByCattle[cattle.cattleId] ?? [],
      asOf
    );
  }
  return result;
}
