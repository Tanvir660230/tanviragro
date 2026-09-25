import { todayDhaka } from "@/lib/dates";
export const ROUGHAGE_TYPES = [
  { id: "straw",  label: "Khor / Straw (খড়)",   labelBn: "খড়",        dmPercent: 0.90 },
  { id: "hay",    label: "Hay (হে)",              labelBn: "হে",         dmPercent: 0.85 },
  { id: "silage", label: "Silage (সাইলেজ)",      labelBn: "সাইলেজ",    dmPercent: 0.35 },
  { id: "grass",  label: "Green Grass (সবুজ ঘাস)", labelBn: "সবুজ ঘাস", dmPercent: 0.20 },
] as const;

export type RoughageTypeId = (typeof ROUGHAGE_TYPES)[number]["id"];

export interface CattleFeedData {
  initialWeightKg: number;
  latestLoggedWeightKg: number | null;
  lastWeighedAt: string | null;
  purchaseDate: string;
  expectedDailyGainKg: number;
  roughageDmPercent?: number; // default 0.90 (straw/khor)
}

export interface FeedRequirement {
  projectedWeightKg: number;
  daysOnFarm: number;
  concentratePercent: number;
  concentrateKg: number;
  roughagePercent: number;
  roughageKg: number;        // as-fed kg
  roughageDmKg: number;      // dry matter kg
  roughageDmPercent: number; // DM fraction used for this calculation
  totalDryMatterKg: number;
  acclimatizationFactor: number;
  actualConcentrateKg: number;
  adgBasedConcentrateKg: number | null;
}

/**
 * Calculates the projected weight of a cow based on its last known weight,
 * the time elapsed since then, and its expected Average Daily Gain (ADG).
 */
export function calculateProjectedWeight(
  data: CattleFeedData,
  targetDateStr: string = todayDhaka()
): { projectedWeight: number; daysSinceWeighing: number; daysOnFarm: number } {
  const targetDate = new Date(targetDateStr);
  const purchaseDate = new Date(data.purchaseDate);

  // If we have a logged weight, use that as the baseline
  const baseWeight = data.latestLoggedWeightKg ?? data.initialWeightKg;
  const baseDate = data.lastWeighedAt ? new Date(data.lastWeighedAt) : purchaseDate;

  const msPerDay = 1000 * 60 * 60 * 24;
  // Allow negative values — target date may be BEFORE the weight log (historical catch-up).
  // In that case, extrapolate backwards: estimatedWeight = loggedWeight - ADG × daysAhead
  const daysSinceWeighing = Math.floor((targetDate.getTime() - baseDate.getTime()) / msPerDay);
  const daysOnFarm = Math.max(0, Math.floor((targetDate.getTime() - purchaseDate.getTime()) / msPerDay));

  // Clamp: floor = initial weight (can't lose below purchase weight for projection purposes)
  //        ceiling = 650 kg (biological maximum for Bangladesh fattening cattle)
  const projectedWeight = Math.min(
    650,
    Math.max(data.initialWeightKg, baseWeight + daysSinceWeighing * data.expectedDailyGainKg)
  );

  return { projectedWeight, daysSinceWeighing, daysOnFarm };
}

/**
 * Calculates the daily feed requirements (Concentrate + Roughage) based on body weight
 * and days on the farm (for acclimatization).
 */
export function calculateDailyFeedRequirement(
  data: CattleFeedData,
  targetDateStr: string = todayDhaka(),
  realDateStr: string = targetDateStr
): FeedRequirement {
  const { projectedWeight } = calculateProjectedWeight(data, targetDateStr);

  const realDate = new Date(realDateStr);
  const purchaseDate = new Date(data.purchaseDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const actualDaysOnFarm = Math.max(0, Math.floor((realDate.getTime() - purchaseDate.getTime()) / msPerDay));

  // Concentrate percentages based on Body Weight (BW)
  // <180 kg → 1.5% BW, 180–300 kg → 2.0% BW, 300+ kg → 1.5% BW
  let concentratePercent = 1.5;
  if (projectedWeight >= 180 && projectedWeight < 300) {
    concentratePercent = 2.0;
  } else if (projectedWeight >= 300) {
    concentratePercent = 1.5;
  }

  // Gradual acclimatization — prevents acidosis from sudden high-concentrate diet
  // Linear ramp from 50% on day 0 to 100% on day 14, then constant.
  // Smooth ramp avoids abrupt step-jumps that could cause rumen upset.
  const acclimatizationFactor =
    actualDaysOnFarm >= 14 ? 1.0 : 0.5 + (actualDaysOnFarm / 14) * 0.5;

  const roughageDmPercent = data.roughageDmPercent ?? 0.90;

  // Total Dry Matter Intake (DMI) ~2.8% BW
  const totalDmiPercent = 2.8;
  // Concentrate is ~90% DM
  const concentrateDmiPercent = concentratePercent * 0.9;
  const roughageDmPercent_ofBW = Math.max(0, totalDmiPercent - concentrateDmiPercent);

  // As-fed roughage = DM needed ÷ DM fraction of chosen roughage type
  const roughagePercent = roughageDmPercent_ofBW / roughageDmPercent;

  const concentrateKg = (projectedWeight * concentratePercent) / 100;
  const actualConcentrateKg = concentrateKg * acclimatizationFactor;

  const roughageDmKg = (projectedWeight * roughageDmPercent_ofBW) / 100;
  const roughageKg = (projectedWeight * roughagePercent) / 100;

  // ADG-based concentrate recommendation
  // Formula: Energy needed for ADG = (ADG × 6.5 MJ NEg) / (concentrate NEg density ~7.5 MJ/kg DM)
  // Practical estimate: each 0.1 kg/day ADG target ≈ 0.15 kg extra concentrate DM beyond maintenance
  // Maintenance concentrate (at 0 ADG) ≈ 0.5% BW; scaled by (1 + ADG / 0.5)
  const targetAdg = data.expectedDailyGainKg;
  const adgBasedConcentrateKg =
    targetAdg > 0 && acclimatizationFactor >= 1.0
      ? Math.min(
          // cap at 3.5% BW — beyond this concentrate causes rumen problems
          (projectedWeight * 3.5) / 100,
          Math.max(concentrateKg, (projectedWeight * 0.5) / 100 * (1 + targetAdg / 0.5))
        )
      : null;

  return {
    projectedWeightKg: projectedWeight,
    daysOnFarm: actualDaysOnFarm,
    concentratePercent,
    concentrateKg,
    actualConcentrateKg,
    roughagePercent,
    roughageKg,
    roughageDmKg,
    roughageDmPercent,
    totalDryMatterKg: actualConcentrateKg * 0.9 + roughageDmKg,
    acclimatizationFactor,
    adgBasedConcentrateKg,
  };
}

/**
 * Returns the "Effective Date" for feeding calculations.
 * Established cows (>3 days) use the feed chart calculated on the *most recent Thursday*.
 * A week starts on Friday and ends on Thursday. So feed given from Fri-Thu is based on
 * the cow's weight projected on the preceding Thursday.
 */
export function getEffectiveFeedDate(todayStr: string = todayDhaka()): string {
  const d = new Date(todayStr);
  const day = d.getDay(); // 0=Sun … 4=Thu … 6=Sat

  // Days to subtract to land on the most recent Thursday (including today if Thursday).
  // Formula: (day - 4 + 7) % 7 gives 0 on Thursday, 1 on Friday, … 6 on Wednesday.
  const offset = (day - 4 + 7) % 7;
  d.setDate(d.getDate() - offset);

  return d.toISOString().slice(0, 10);
}

export interface FeedCostParams {
  daysInPen: number;
  startMs: number;
  recipes: { active_from: string; active_until: string | null; recipe_ingredients: { item_id: string; qty_per_batch: number }[] }[];
  /** unit + kg_per_unit decide how a per-unit roughage price becomes a per-kg price */
  roughages: { id: string; roughage_active_from: string; roughage_active_until: string | null; unit?: string; kg_per_unit?: number | null }[];
  /** item_id → weighted-average unit cost (see buildWacUnitCostMap) */
  unitCostMap: Record<string, number>;
  feedData: CattleFeedData;
  overrideRoughage: number | null;
}

/**
 * ESTIMATED feed cost over the days a cattle has been in the pen: ration formula ×
 * weighted-average unit cost. This is a plan-based estimate, NOT recorded consumption, and
 * must be labelled as such wherever it is shown. It must never be added to the actual
 * (ledger) feed cost of the same animal.
 *
 * Roughage kg are priced per kg: a per-piece price is converted with kg_per_unit. When the
 * conversion (or any price) is unknown, that part is left out and reported via
 * roughageCostUnknown / costComplete — never priced as ৳/piece × kg or as ৳0.
 */
export function calculateAlgorithmicFeedCost(params: FeedCostParams) {
  const { daysInPen, startMs, recipes, roughages, unitCostMap, feedData, overrideRoughage } = params;

  let allocatedFeedCost = 0;
  let allocatedConcentrateKg = 0;
  let allocatedRoughageKg = 0;
  let roughageCostUnknown = false;
  let concentrateCostUnknown = false;

  if (daysInPen <= 0 || startMs <= 0) {
    return { allocatedFeedCost, allocatedConcentrateKg, allocatedRoughageKg, roughageCostUnknown, costComplete: true };
  }

  function getCostsForDate(dateStr: string) {
    let activeRecipe = recipes.find(r => r.active_from <= dateStr && (!r.active_until || r.active_until >= dateStr));
    if (!activeRecipe && recipes.length > 0) {
      activeRecipe = [...recipes].sort((a, b) => b.active_from.localeCompare(a.active_from)).find(r => r.active_from <= dateStr) || recipes[0];
    }
    
    let mixFeedUnitCost = 0;
    let mixCostKnown = true;
    if (activeRecipe) {
      let totalCost = 0;
      let totalQty = 0;
      for (const ing of activeRecipe.recipe_ingredients) {
        totalQty += ing.qty_per_batch;
        const c = unitCostMap[ing.item_id];
        if (c == null) mixCostKnown = false;
        totalCost += ing.qty_per_batch * (c ?? 0);
      }
      if (totalQty > 0) mixFeedUnitCost = totalCost / totalQty;
    }

    let activeRoughage = roughages.find(r => r.roughage_active_from <= dateStr && (!r.roughage_active_until || r.roughage_active_until >= dateStr));
    if (!activeRoughage && roughages.length > 0) {
      activeRoughage = [...roughages].sort((a, b) => b.roughage_active_from.localeCompare(a.roughage_active_from)).find(r => r.roughage_active_from <= dateStr) || roughages[0];
    }
    // ৳ per KG of roughage (null = unknown: no price, or kg per piece not set)
    const roughageCostPerKg = activeRoughage
      ? roughagePricePerKg(unitCostMap[activeRoughage.id], activeRoughage.unit, activeRoughage.kg_per_unit)
      : 0;

    return { mixFeedUnitCost, mixCostKnown, roughageCostPerKg };
  }

  function addCost(concKg: number, roughKg: number, dateStr: string, count: number) {
    const { mixFeedUnitCost, mixCostKnown, roughageCostPerKg } = getCostsForDate(dateStr);
    if (!mixCostKnown && concKg > 0) concentrateCostUnknown = true;
    if (roughageCostPerKg == null && roughKg > 0) roughageCostUnknown = true;
    allocatedFeedCost += (concKg * mixFeedUnitCost + roughKg * (roughageCostPerKg ?? 0)) * count;
  }

  function accumDay(req: FeedRequirement, dateStr: string, count = 1) {
    const rkg = overrideRoughage !== null ? overrideRoughage : req.roughageKg;
    allocatedConcentrateKg += req.actualConcentrateKg * count;
    allocatedRoughageKg    += rkg * count;
    addCost(req.actualConcentrateKg, rkg, dateStr, count);
  }

  // Phase 1 — acclimatization (days 0–13): compute exactly, ≤14 iterations
  const phase1 = Math.min(daysInPen, 14);
  for (let i = 0; i < phase1; i++) {
    const d = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
    accumDay(calculateDailyFeedRequirement(feedData, d, d), d);
  }

  // Phase 2 — post-acclimatization (day 14+): trapezoidal rule every 30 days
  const STEP = 30;
  for (let dayStart = 14; dayStart < daysInPen; dayStart += STEP) {
    const dayEnd = Math.min(dayStart + STEP - 1, daysInPen - 1);
    const segLen = dayEnd - dayStart + 1;
    if (segLen === 1) {
      const d = new Date(startMs + dayStart * 86400000).toISOString().slice(0, 10);
      accumDay(calculateDailyFeedRequirement(feedData, d, d), d);
    } else {
      const dStart = new Date(startMs + dayStart * 86400000).toISOString().slice(0, 10);
      const dEnd   = new Date(startMs + dayEnd   * 86400000).toISOString().slice(0, 10);
      const rS = calculateDailyFeedRequirement(feedData, dStart, dStart);
      const rE = calculateDailyFeedRequirement(feedData, dEnd,   dEnd);
      const avgConc = (rS.actualConcentrateKg + rE.actualConcentrateKg) / 2;
      const roughS = overrideRoughage !== null ? overrideRoughage : rS.roughageKg;
      const roughE = overrideRoughage !== null ? overrideRoughage : rE.roughageKg;
      const avgRough = (roughS + roughE) / 2;
      const midDate = new Date(startMs + (dayStart + segLen / 2) * 86400000).toISOString().slice(0, 10);
      allocatedConcentrateKg += avgConc  * segLen;
      allocatedRoughageKg    += avgRough * segLen;
      addCost(avgConc, avgRough, midDate, segLen);
    }
  }

  return {
    allocatedFeedCost,
    allocatedConcentrateKg,
    allocatedRoughageKg,
    /** roughage kg could not be priced (unknown kg per piece or no price) — excluded from the cost */
    roughageCostUnknown,
    /** false when any part of the estimate had no known price (the cost is then a lower bound) */
    costComplete: !roughageCostUnknown && !concentrateCostUnknown,
  };
}

/** ৳/kg of a roughage priced per its own unit; null when unknown. */
function roughagePricePerKg(unitCost: number | undefined, unit: string | undefined, kgPerUnit: number | null | undefined): number | null {
  if (unitCost == null) return null;
  if ((unit ?? "").trim().toLowerCase() === "kg") return unitCost;
  return kgPerUnit && kgPerUnit > 0 ? unitCost / kgPerUnit : null;
}
