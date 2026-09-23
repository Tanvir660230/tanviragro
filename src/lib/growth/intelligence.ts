import {
  type WeightRecord,
  type GrowthTarget,
  type GrowthAlert,
  type AnimalGrowthProfile,
} from "./types";
import {
  calculateWindowAdg,
  daysBetween,
} from "./calculator";

/**
 * Autonomous growth anomaly detection engine
 */
export function detectGrowthAnomalies(
  cattleId: string,
  tagId: string,
  records: WeightRecord[],
  target?: GrowthTarget | null,
  todayISO: string = new Date().toISOString().slice(0, 10)
): GrowthAlert[] {
  const alerts: GrowthAlert[] = [];
  if (!records || records.length === 0) {
    alerts.push({
      id: `alert-no-weight-${cattleId}`,
      cattleId,
      tagId,
      type: "missed_measurement",
      severity: "warning",
      title: "No Weight Measurements Logged",
      message: `Tag ${tagId} has no recorded weigh-ins. Growth rate cannot be determined.`,
      currentWeightKg: 0,
      recommendation: "Record initial baseline weight via manual scale or girth tape.",
      actionType: "weigh",
      dateISO: todayISO,
    });
    return alerts;
  }

  const sorted = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const currentWeight = latest.weight_kg;
  const daysSinceLastWeighed = daysBetween(latest.recorded_at, todayISO);

  // 1. Missed Measurement Check (> 30 days since last weigh-in)
  if (daysSinceLastWeighed > 30) {
    alerts.push({
      id: `alert-overdue-weigh-${cattleId}`,
      cattleId,
      tagId,
      type: "missed_measurement",
      severity: daysSinceLastWeighed > 45 ? "critical" : "warning",
      title: "Overdue Weigh-in",
      message: `Last weighed ${daysSinceLastWeighed} days ago (${latest.recorded_at}). Bi-weekly or monthly logging recommended.`,
      currentWeightKg: currentWeight,
      daysSinceLastWeighed,
      recommendation: "Schedule a weigh-in to maintain accurate ADG and feed conversion tracking.",
      actionType: "weigh",
      dateISO: todayISO,
    });
  }

  if (sorted.length >= 2) {
    const previous = sorted[sorted.length - 2];
    const weightDelta = currentWeight - previous.weight_kg;
    const daysInterval = daysBetween(previous.recorded_at, latest.recorded_at);
    const intervalAdg = calculateWindowAdg(sorted, 30);

    // 2. Rapid Weight Loss Check
    if (weightDelta < 0 && Math.abs(weightDelta) >= currentWeight * 0.02) {
      alerts.push({
        id: `alert-rapid-loss-${cattleId}`,
        cattleId,
        tagId,
        type: "rapid_loss",
        severity: "critical",
        title: "Acute Weight Loss Detected",
        message: `Lost ${Math.abs(weightDelta).toFixed(1)} kg (${((Math.abs(weightDelta) / previous.weight_kg) * 100).toFixed(1)}%) in ${daysInterval} days.`,
        currentWeightKg: currentWeight,
        deltaKg: weightDelta,
        adgKg: intervalAdg,
        recommendation: "Immediate veterinary triage: check for fever, parasites, acidosis, or lameness.",
        actionType: "health_check",
        dateISO: todayISO,
      });
    }

    // 3. Rapid Unrealistic Gain Check
    if (intervalAdg > 2.5 && daysInterval >= 5) {
      alerts.push({
        id: `alert-rapid-gain-${cattleId}`,
        cattleId,
        tagId,
        type: "rapid_gain",
        severity: "warning",
        title: "Abnormal High Weight Surge",
        message: `ADG of ${intervalAdg.toFixed(2)} kg/day over ${daysInterval} days exceeds biological norms.`,
        currentWeightKg: currentWeight,
        deltaKg: weightDelta,
        adgKg: intervalAdg,
        recommendation: "Re-verify scale calibration or check for rumen bloat / water engorgement.",
        actionType: "weigh",
        dateISO: todayISO,
      });
    }

    // 4. Growth Plateau Check (Gain < 0.10 kg/day over >= 25 days)
    if (daysInterval >= 25 && intervalAdg >= 0 && intervalAdg < 0.12) {
      alerts.push({
        id: `alert-plateau-${cattleId}`,
        cattleId,
        tagId,
        type: "growth_plateau",
        severity: "warning",
        title: "Growth Plateau / Stagnation",
        message: `Negligible gain (+${weightDelta.toFixed(1)} kg) over ${daysInterval} days (ADG: ${intervalAdg.toFixed(2)} kg/day).`,
        currentWeightKg: currentWeight,
        adgKg: intervalAdg,
        recommendation: "Review nutrition energy density and check for subclinical disease.",
        actionType: "adjust_ration",
        dateISO: todayISO,
      });
    }

    // 5. Poor Growth Check
    if (intervalAdg >= 0.12 && intervalAdg < 0.40 && currentWeight < 500) {
      alerts.push({
        id: `alert-poor-growth-${cattleId}`,
        cattleId,
        tagId,
        type: "poor_growth",
        severity: "info",
        title: "Suboptimal Daily Gain",
        message: `Recent ADG is ${intervalAdg.toFixed(2)} kg/day, lagging behind herd target benchmarks.`,
        currentWeightKg: currentWeight,
        adgKg: intervalAdg,
        recommendation: "Evaluate trough bunk space competition and consider booster ration.",
        actionType: "adjust_ration",
        dateISO: todayISO,
      });
    }
  }

  // 6. Target Deadline Slippage
  if (target && target.target_finish_date && target.status === "active") {
    const finishDeadline = new Date(target.target_finish_date).getTime();
    const now = new Date(todayISO).getTime();
    const daysRemaining = Math.max(1, Math.round((finishDeadline - now) / (1000 * 60 * 60 * 24)));
    const neededGainKg = target.target_weight_kg - currentWeight;

    if (neededGainKg > 0) {
      const requiredAdg = neededGainKg / daysRemaining;
      const recentAdg = calculateWindowAdg(records, 60);

      if (requiredAdg > recentAdg * 1.5 && requiredAdg > 1.2) {
        alerts.push({
          id: `alert-target-slip-${cattleId}`,
          cattleId,
          tagId,
          type: "target_slippage",
          severity: "warning",
          title: "Target Finish Date Slippage Risk",
          message: `Needs ${requiredAdg.toFixed(2)} kg/day to hit ${target.target_weight_kg}kg by ${target.target_finish_date} (Current: ${recentAdg.toFixed(2)} kg/day).`,
          currentWeightKg: currentWeight,
          recommendation: "Adjust target deadline or switch to high-energy intensive finishing ration.",
          actionType: "review_target",
          dateISO: todayISO,
        });
      }
    }
  }

  return alerts;
}

/**
 * Generates tailored growth and nutrition recommendations for an animal profile
 */
export function generateGrowthRecommendations(profile: AnimalGrowthProfile): string[] {
  const recs: string[] = [];

  if (profile.performanceTier === "critical" || profile.recent30dAdgKg < 0.3) {
    recs.push("Initiate veterinary health audit (check fecal egg count, respiratory score, and rumen pH).");
    recs.push("Review pen density and bunk feeder space to prevent dominant cattle exclusion.");
  } else if (profile.performanceTier === "underperforming") {
    recs.push("Step up dietary Crude Protein by 1.5% and Dry Matter Intake (DMI) by 0.5 kg/head/day.");
  } else if (profile.performanceTier === "elite") {
    recs.push("High-performing genetic response — maintain current balanced TMR ration.");
  }

  if (profile.currentBcs < 3.0) {
    recs.push("Animal is under-conditioned (BCS < 3.0). Increase grain concentrate and bypass fat energy.");
  } else if (profile.currentBcs > 4.5 && profile.growthStage === "finisher") {
    recs.push("Optimal finish condition reached (BCS > 4.5). Schedule for market dispatch / slaughter.");
  }

  if (profile.daysSinceLastWeighed > 21) {
    recs.push("Routine weighing due within 7 days to maintain accurate Feed Conversion Ratio (FCR).");
  }

  return recs;
}
