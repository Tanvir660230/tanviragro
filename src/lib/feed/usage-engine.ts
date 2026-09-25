/**
 * THE authoritative feed usage / cost calculation (pure, no I/O).
 * Design: docs/FEED_USAGE_ARCHITECTURE.md §3.3. Every page that shows feed quantity or
 * feed cost per animal, per day or per feed must use computeFeedSnapshot().
 *
 * Status of every number:
 *   ACTUAL        closed & reconciled usage periods + recorded consumption rows
 *   ESTIMATED     open usage periods (running estimate — never stored)
 *   UNRECONCILED  closed periods with a stock gap or unknown cost; rows without a cost
 *
 * Allocation (never stored):
 *   - an animal takes part only while it is in the herd (from → to, inclusive)
 *   - weight on a day: latest MEASURED weight on/before the day, else the first measured
 *     weight after it, else the initial weight (labelled estimated when it was a guess)
 *   - a period's quantity is split over its days by the herd's need that day, and each
 *     day's quantity over the animals by their own need (live-weight based)
 */

export type WeightBasis = "measured" | "estimated" | "none";
export type RuleType = "weight_share" | "pct_live_weight" | "per_head" | "chart";

/** One weight band of a feeding chart: per_head = target unit per animal per day (recipe = kg of mix); pct_bw = % of live weight (kg). */
export type ChartBand = { minKg: number; maxKg: number | null; amount: number; basis: "per_head" | "pct_bw" };
/** A feeding chart version for one feed item or recipe, valid from effectiveFrom until the next version. */
export type ChartVersion = { id: string; targetType: "item" | "recipe"; targetId: string; effectiveFrom: string; bands: ChartBand[]; notes?: string | null };

export type Animal = {
  id: string;
  tag: string;
  from: string;              // YYYY-MM-DD, first day in the herd
  to: string | null;         // last day in the herd (null = still here)
  initialWeightKg: number | null;
  initialWeightType: "measured" | "estimated" | "unknown";
  logs: { date: string; kg: number; type: "measured" | "estimated" }[];
};

export type PeriodLine = {
  itemId: string;
  itemName: string;
  unit: string;
  kgPerUnit: number | null;
  share: number;             // recipe share snapshot (1 for an item period)
  consumedQty: number | null;
  consumedValue: number | null;
  gapQty: number | null;
  costMissing: boolean;
  closingQty: number | null;
  lineId?: string;
  /** open period: the line's own postings (automatic daily rows), net per day */
  posted?: Record<string, { qty: number; value: number }>;
};

export type Period = {
  id: string;
  targetType: "item" | "recipe";
  targetId?: string;
  targetName: string;
  /** open period: last day whose automatic consumption has been posted */
  autoPostedThrough?: string | null;
  status: "open" | "closed" | "unreconciled";
  startDate: string;
  endDate: string | null;
  ruleType: RuleType;
  ruleValue: number | null;
  lines: PeriodLine[];
};

/**
 * Consumption rows recorded outside periods (manual / legacy). qty < 0 = audited reversal.
 * coversFrom: a herd row that covers several days (e.g. a stock-finished catch-up) — it is
 * spread from coversFrom to date by the weight of the animals present each day.
 */
export type RecordedRow = { date: string; coversFrom?: string | null; itemId: string; itemName?: string; unit?: string; kgPerUnit?: number | null; qty: number; unitCost: number | null; cattleId: string | null };

export type AnimalFeed = {
  actual: number; estimated: number;
  actualQtyByItem: Record<string, number>; actualValueByItem: Record<string, number>; estimatedQtyByItem: Record<string, number>;
  /** ACTUAL feed value per day (YYYY-MM-DD) — for costs over an exact window, e.g. a measured gain */
  actualByDay: Record<string, number>;
  /** ACTUAL feed kg per day, only for items in kg or with a known kg per unit (never guessed) */
  actualKgByDay: Record<string, number>;
};

/** kg in one stock unit: 1 for kg items, the item's kg-per-unit when known, else null. */
export function kgFactor(unit: string | undefined, kgPerUnit: number | null | undefined): number | null {
  return (unit ?? "").trim().toLowerCase() === "kg" ? 1 : kgPerUnit ?? null;
}

/** Actual feed kg of one animal between two days (inclusive); items without a kg factor excluded. */
export function feedKgBetween(f: AnimalFeed | undefined, from: string, to: string): number {
  if (!f) return 0;
  let s = 0;
  for (const [d, v] of Object.entries(f.actualKgByDay)) if (d >= from && d <= to) s += v;
  return s;
}

/** Actual feed value of one animal between two days (inclusive). */
export function feedCostBetween(f: AnimalFeed | undefined, from: string, to: string): number {
  if (!f) return 0;
  let s = 0;
  for (const [d, v] of Object.entries(f.actualByDay)) if (d >= from && d <= to) s += v;
  return s;
}

export type LineResult = {
  periodId: string;
  itemId: string;
  itemName: string;
  unit: string;
  status: "actual" | "estimated" | "unreconciled";
  days: number;
  qty: number | null;              // actual consumed, or running estimate to date
  value: number | null;
  dailyQty: number | null;         // qty / days
  expectedQty: number | null;      // by rule or learned usage (for variance)
  varianceQty: number | null;
  variancePct: number | null;
  gapQty: number;
  estimateBasis: "rule" | "learned" | "none" | null;   // for open periods
  /** open period: already deducted from stock automatically (final at the count) */
  postedQty?: number;
  postedValue?: number;
  /** open period: estimate for the days not deducted yet (today) */
  pendingQty?: number;
  lastPosted?: string | null;
};

export type FeedSnapshot = {
  asOf: string;
  perAnimal: Record<string, AnimalFeed>;
  lines: LineResult[];
  totals: { actual: number; estimated: number; unreconciledLines: number; recordedMissingCost: number };
  byMonth: Record<string, { actual: number; estimated: number }>;
  byItem: Record<string, { name: string; unit: string; actualQty: number; actualValue: number; estimatedQty: number; estimatedValue: number }>;
  learnedDaily: Record<string, number>;
  unallocated: number;             // value on days with no animal present
};

// ── dates ───────────────────────────────────────────────────────────────────
const DAY = 86400000;
export function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
export function daysBetweenInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}
const isPresent = (a: Animal, day: string) => a.from <= day && (a.to == null || day <= a.to);

// ── weights ─────────────────────────────────────────────────────────────────
export function weightOn(a: Animal, day: string): { kg: number; basis: WeightBasis } {
  const measured = a.logs.filter((l) => l.type === "measured").sort((x, y) => x.date.localeCompare(y.date));
  const before = [...measured].reverse().find((l) => l.date <= day);
  if (before) return { kg: before.kg, basis: "measured" };
  if (a.initialWeightKg && a.initialWeightType !== "estimated" && a.from <= day) return { kg: a.initialWeightKg, basis: "measured" };
  const after = measured.find((l) => l.date > day);
  if (after) return { kg: after.kg, basis: "measured" };
  if (a.initialWeightKg) return { kg: a.initialWeightKg, basis: "estimated" };
  return { kg: 0, basis: "none" };
}

// ── feeding chart ───────────────────────────────────────────────────────────
/** The chart version in force on a day for a target (latest effectiveFrom ≤ day), or null. */
export function chartOn(charts: ChartVersion[] | undefined, targetType: "item" | "recipe", targetId: string | undefined, day: string): ChartVersion | null {
  if (!charts?.length || !targetId) return null;
  let best: ChartVersion | null = null;
  for (const c of charts) {
    if (c.targetType !== targetType || c.targetId !== targetId || c.effectiveFrom > day) continue;
    if (!best || c.effectiveFrom > best.effectiveFrom) best = c;
  }
  return best;
}

/** The band for a live weight; an animal with no known weight takes the first (lightest) band. */
export function bandFor(chart: ChartVersion, kg: number): ChartBand | null {
  const bands = [...chart.bands].sort((a, b) => a.minKg - b.minKg);
  if (!(kg > 0)) return bands[0] ?? null;
  return bands.find((b) => kg >= b.minKg && (b.maxKg == null || kg < b.maxKg)) ?? bands[bands.length - 1] ?? null;
}

/** Chart amount for one animal on a day: in the target's unit (per head) or kg (% of weight). */
export function chartAmount(chart: ChartVersion, kg: number): { amount: number; inKg: boolean } | null {
  const b = bandFor(chart, kg);
  if (!b) return null;
  return b.basis === "pct_bw" ? { amount: (kg * b.amount) / 100, inKg: true } : { amount: b.amount, inKg: false };
}

/** An animal's need on a day, in the ITEM's unit when the rule allows it, else a weight share. */
export function need(
  a: Animal, day: string, rule: RuleType, ruleValue: number | null,
  line: Pick<PeriodLine, "unit" | "kgPerUnit" | "share">,
  chart?: { version: ChartVersion | null; targetType: "item" | "recipe" },
): { qty: number | null; share: number } {
  const w = weightOn(a, day).kg;
  if (rule === "chart") {
    const c = chart?.version ? chartAmount(chart.version, w) : null;
    if (!c) return { qty: null, share: w };
    const unitKg = kgFactor(line.unit, line.kgPerUnit);
    // a recipe chart is in kg of mix; an item chart per head is already in the item's unit
    const inKg = c.inKg || chart!.targetType === "recipe";
    const target = c.amount * line.share;
    const qty = inKg ? (unitKg ? target / unitKg : null) : target;
    return { qty, share: target };
  }
  if (rule === "per_head" && ruleValue) return { qty: ruleValue * line.share, share: ruleValue * line.share };
  if (rule === "pct_live_weight" && ruleValue) {
    const kg = (w * ruleValue) / 100 * line.share;
    const unitKg = line.unit.trim().toLowerCase() === "kg" ? 1 : line.kgPerUnit;
    return { qty: unitKg ? kg / unitKg : null, share: kg };
  }
  return { qty: null, share: w };
}

/**
 * One line of a period on one day: each present animal's need (allocation weights) and the
 * herd's quantity by the rule / chart in the item's unit (null when the rule cannot say).
 */
export function dayPlan(p: Period, l: PeriodLine, day: string, animals: Animal[], charts?: ChartVersion[]): { weights: Map<string, number>; ruleQty: number | null } {
  const weights = new Map<string, number>();
  let ruleQty = 0;
  let complete = p.ruleType !== "weight_share";
  const chart = p.ruleType === "chart" ? { version: chartOn(charts, p.targetType, p.targetId, day), targetType: p.targetType } : undefined;
  for (const a of animals) {
    if (!isPresent(a, day)) continue;
    const n = need(a, day, p.ruleType, p.ruleValue, l, chart);
    weights.set(a.id, n.share);
    if (n.qty == null) complete = false; else ruleQty += n.qty;
  }
  return { weights, ruleQty: complete ? ruleQty : null };
}

/**
 * Automatic daily consumption still to post: for every open period line, each completed day
 * (after autoPostedThrough, up to the day before asOf) by the rule / chart, else by learned usage.
 * Days nobody can quantify are skipped (the count at the end settles them).
 */
export function autoRowsDue(input: { asOf: string; periods: Period[]; animals: Animal[]; charts?: ChartVersion[] }): { rows: { lineId: string; date: string; qty: number }[]; periodIds: string[]; through: string } {
  const through = new Date(Date.parse(`${input.asOf}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
  const learned = learnedDailyUsage(input.periods);
  const rows: { lineId: string; date: string; qty: number }[] = [];
  const periodIds: string[] = [];
  for (const p of input.periods) {
    if (p.status !== "open" || p.startDate > through) continue;
    const from = p.autoPostedThrough && p.autoPostedThrough >= p.startDate
      ? new Date(Date.parse(`${p.autoPostedThrough}T00:00:00Z`) + DAY).toISOString().slice(0, 10) : p.startDate;
    if (from > through) continue;
    periodIds.push(p.id);
    for (const day of dayList(from, through)) {
      for (const l of p.lines) {
        if (!l.lineId || l.posted?.[day]) continue;
        const plan = dayPlan(p, l, day, input.animals, input.charts);
        const anyone = plan.weights.size > 0;
        const qty = plan.ruleQty ?? (anyone ? learned[l.itemId] ?? null : null);
        if (qty != null && qty > 0.00005) rows.push({ lineId: l.lineId, date: day, qty: Math.round(qty * 10000) / 10000 });
      }
    }
  }
  return { rows, periodIds, through };
}

// ── learned usage (from closed periods only; history is never changed) ───────
export function learnedDailyUsage(periods: Period[], maxPeriods = 3): Record<string, number> {
  const byItem: Record<string, { qty: number; days: number; end: string }[]> = {};
  for (const p of periods) {
    if (p.status !== "closed" || !p.endDate) continue;
    const days = daysBetweenInclusive(p.startDate, p.endDate);
    for (const l of p.lines) if (l.consumedQty != null && days > 0) (byItem[l.itemId] ??= []).push({ qty: l.consumedQty, days, end: p.endDate });
  }
  const out: Record<string, number> = {};
  for (const [id, list] of Object.entries(byItem)) {
    const recent = list.sort((a, b) => b.end.localeCompare(a.end)).slice(0, maxPeriods);
    const q = recent.reduce((s, r) => s + r.qty, 0);
    const d = recent.reduce((s, r) => s + r.days, 0);
    if (d > 0) out[id] = q / d;
  }
  return out;
}

export function forecastDepletion(stockQty: number, dailyQty: number | null | undefined, asOf: string): { daysLeft: number | null; date: string | null } {
  if (!dailyQty || dailyQty <= 0) return { daysLeft: null, date: null };
  if (stockQty <= 0) return { daysLeft: 0, date: asOf };
  const daysLeft = stockQty / dailyQty;
  return { daysLeft, date: new Date(Date.parse(`${asOf}T00:00:00Z`) + Math.floor(daysLeft) * DAY).toISOString().slice(0, 10) };
}

export function variance(expected: number | null, actual: number | null): { qty: number | null; pct: number | null } {
  if (expected == null || actual == null) return { qty: null, pct: null };
  const qty = actual - expected;
  return { qty, pct: expected > 0 ? (qty / expected) * 100 : null };
}

// ── the snapshot ────────────────────────────────────────────────────────────
function blankAnimal(): AnimalFeed { return { actual: 0, estimated: 0, actualQtyByItem: {}, actualValueByItem: {}, estimatedQtyByItem: {}, actualByDay: {}, actualKgByDay: {} }; }

export function computeFeedSnapshot(input: {
  asOf: string;
  periods: Period[];
  animals: Animal[];
  recorded: RecordedRow[];
  wac: Record<string, number | null>;
  charts?: ChartVersion[];
}): FeedSnapshot {
  const { asOf, periods, animals, recorded, wac, charts } = input;
  const perAnimal: Record<string, AnimalFeed> = Object.fromEntries(animals.map((a) => [a.id, blankAnimal()]));
  const byMonth: FeedSnapshot["byMonth"] = {};
  const byItem: FeedSnapshot["byItem"] = {};
  const lines: LineResult[] = [];
  const learnedAll = learnedDailyUsage(periods);
  let unallocated = 0;
  let totalActual = 0;
  let totalEstimated = 0;
  let unreconciledLines = 0;

  const itemBucket = (l: { itemId: string; itemName: string; unit: string }) =>
    (byItem[l.itemId] ??= { name: l.itemName, unit: l.unit, actualQty: 0, actualValue: 0, estimatedQty: 0, estimatedValue: 0 });
  const month = (d: string) => (byMonth[d.slice(0, 7)] ??= { actual: 0, estimated: 0 });

  // spreads qty/value of a day over the animals present, by their need
  function spreadDay(day: string, qty: number, value: number, weights: Map<string, number>, kind: "actual" | "estimated", itemId: string, kgPer: number | null = null) {
    const total = [...weights.values()].reduce((s, w) => s + w, 0);
    if (total <= 0) { unallocated += value; return; }
    for (const [id, w] of weights) {
      const f = perAnimal[id];
      if (kind === "actual") {
        f.actual += value * (w / total);
        f.actualByDay[day] = (f.actualByDay[day] ?? 0) + value * (w / total);
        if (kgPer != null) f.actualKgByDay[day] = (f.actualKgByDay[day] ?? 0) + qty * kgPer * (w / total);
        f.actualQtyByItem[itemId] = (f.actualQtyByItem[itemId] ?? 0) + qty * (w / total);
        f.actualValueByItem[itemId] = (f.actualValueByItem[itemId] ?? 0) + value * (w / total);
      }
      else { f.estimated += value * (w / total); f.estimatedQtyByItem[itemId] = (f.estimatedQtyByItem[itemId] ?? 0) + qty * (w / total); }
    }
  }

  for (const p of periods) {
    const end = p.endDate ?? asOf;
    if (end < p.startDate) continue;
    const days = dayList(p.startDate, end);
    for (const l of p.lines) {
      // need of each present animal on each day (qty in item unit when the rule gives one)
      const perDay = days.map((day) => ({ day, ...dayPlan(p, l, day, animals, charts) }));
      const ruleTotal = perDay.every((d) => d.ruleQty != null) ? perDay.reduce((s, d) => s + (d.ruleQty ?? 0), 0) : null;
      const bucket = itemBucket(l);

      if (p.status === "open") {
        // Days already deducted automatically are on the books (ACTUAL until the count adjusts them);
        // the days after the last automatic posting are a RUNNING ESTIMATE: rule / chart, else learned usage.
        const learned = learnedAll[l.itemId];
        const posted = l.posted ?? {};
        const postedThrough = p.autoPostedThrough ?? null;
        const cost = wac[l.itemId] ?? null;
        let postedQty = 0, postedValue = 0, pendingQty = 0, pendingValue = 0, pendingKnown = true, anyPending = false;
        let lastPosted: string | null = null;
        let usedRule = false, usedLearned = false;
        for (const d of perDay) {
          const pr = posted[d.day];
          if (pr) {
            postedQty += pr.qty; postedValue += pr.value;
            if (!lastPosted || d.day > lastPosted) lastPosted = d.day;
            spreadDay(d.day, pr.qty, pr.value, d.weights, "actual", l.itemId, kgFactor(l.unit, l.kgPerUnit));
            month(d.day).actual += pr.value;
            continue;
          }
          if (postedThrough && d.day <= postedThrough) continue;     // settled at the count
          anyPending = true;
          const q = d.ruleQty ?? (d.weights.size > 0 && learned ? learned : null);
          if (q == null) { pendingKnown = false; continue; }
          if (d.ruleQty != null) usedRule = true; else usedLearned = true;
          const v = cost != null ? q * cost : 0;
          pendingQty += q; pendingValue += v;
          spreadDay(d.day, q, v, d.weights, "estimated", l.itemId);
          month(d.day).estimated += v;
        }
        if (postedQty) { bucket.actualQty += postedQty; bucket.actualValue += postedValue; totalActual += postedValue; }
        bucket.estimatedQty += pendingQty;
        bucket.estimatedValue += pendingValue;
        totalEstimated += pendingValue;
        const basis: LineResult["estimateBasis"] = usedRule || (ruleTotal != null && !usedLearned) ? "rule" : usedLearned || learned ? "learned" : "none";
        const nothing = postedQty === 0 && (!anyPending || !pendingKnown) && pendingQty === 0;
        const qty = nothing ? null : postedQty + pendingQty;
        const value = qty == null ? null : postedValue + (cost != null ? pendingValue : 0);
        // today's daily figure (current herd and chart) is the best forecast of what comes next
        const todayPlan = perDay[perDay.length - 1];
        const dailyQty = todayPlan?.ruleQty ?? (learned || (qty != null ? qty / days.length : null));
        lines.push({
          periodId: p.id, itemId: l.itemId, itemName: l.itemName, unit: l.unit, status: "estimated", days: days.length,
          qty, value: cost == null && postedQty === 0 ? null : value, dailyQty,
          expectedQty: null, varianceQty: null, variancePct: null, gapQty: 0, estimateBasis: basis,
          postedQty, postedValue, pendingQty, lastPosted,
        });
        continue;
      }

      // CLOSED: actual quantity split by the herd's need per day
      const qty = l.consumedQty ?? 0;
      const value = l.consumedValue ?? 0;
      const unreconciled = p.status === "unreconciled" || (l.gapQty ?? 0) > 0 || l.costMissing;
      if (unreconciled) unreconciledLines++;
      const dayNeeds = perDay.map((d) => [...d.weights.values()].reduce((s, w) => s + w, 0));
      const needTotal = ruleTotal ?? dayNeeds.reduce((s, x) => s + x, 0);
      perDay.forEach((d, i) => {
        const dayShare = needTotal > 0 ? (ruleTotal != null ? (d.ruleQty ?? 0) : dayNeeds[i]) / needTotal : 1 / perDay.length;
        spreadDay(d.day, qty * dayShare, value * dayShare, d.weights, "actual", l.itemId, kgFactor(l.unit, l.kgPerUnit));
        month(d.day).actual += value * dayShare;
      });
      bucket.actualQty += qty;
      bucket.actualValue += value;
      totalActual += value;

      // expected for variance: the rule, else usage learned from EARLIER periods only
      const earlier = learnedDailyUsage(periods.filter((x) => x.endDate && x.endDate < p.startDate));
      const expected = ruleTotal != null ? ruleTotal : earlier[l.itemId] != null ? earlier[l.itemId] * days.length : null;
      const v = variance(expected, l.consumedQty);
      lines.push({
        periodId: p.id, itemId: l.itemId, itemName: l.itemName, unit: l.unit,
        status: unreconciled ? "unreconciled" : "actual", days: days.length,
        qty: l.consumedQty, value: l.consumedValue, dailyQty: l.consumedQty != null ? l.consumedQty / days.length : null,
        expectedQty: expected, varianceQty: v.qty, variancePct: v.pct, gapQty: l.gapQty ?? 0, estimateBasis: null,
      });
    }
  }

  // recorded rows outside periods: an animal's own rows stay with it; herd rows split by weight that day
  let recordedMissingCost = 0;
  for (const r of recorded) {
    if (r.unitCost == null) { if (r.qty > 0) recordedMissingCost++; continue; }
    const value = r.qty * r.unitCost;
    totalActual += value;
    const b = itemBucket({ itemId: r.itemId, itemName: r.itemName ?? r.itemId, unit: r.unit ?? "" });
    b.actualQty += r.qty;
    b.actualValue += value;
    if (r.cattleId) {
      const f = (perAnimal[r.cattleId] ??= blankAnimal());
      f.actual += value;
      f.actualByDay[r.date] = (f.actualByDay[r.date] ?? 0) + value;
      { const k = kgFactor(r.unit, r.kgPerUnit); if (k != null) f.actualKgByDay[r.date] = (f.actualKgByDay[r.date] ?? 0) + r.qty * k; }
      f.actualQtyByItem[r.itemId] = (f.actualQtyByItem[r.itemId] ?? 0) + r.qty;
      f.actualValueByItem[r.itemId] = (f.actualValueByItem[r.itemId] ?? 0) + value;
      month(r.date).actual += value;
      continue;
    }
    // one day, or every day the row covers — each day's share = the herd's weight that day
    const days = r.coversFrom && r.coversFrom < r.date ? dayList(r.coversFrom, r.date) : [r.date];
    const perDay = days.map((day) => {
      const weights = new Map<string, number>();
      for (const a of animals) if (isPresent(a, day)) weights.set(a.id, weightOn(a, day).kg || 1);
      return { day, weights, total: [...weights.values()].reduce((s, w) => s + w, 0) };
    });
    const herdTotal = perDay.reduce((s, d) => s + d.total, 0);
    for (const d of perDay) {
      const share = herdTotal > 0 ? d.total / herdTotal : 1 / perDay.length;
      spreadDay(d.day, r.qty * share, value * share, d.weights, "actual", r.itemId, kgFactor(r.unit, r.kgPerUnit));
      month(d.day).actual += value * share;
    }
  }

  return {
    asOf, perAnimal, lines, byMonth, byItem, learnedDaily: learnedAll, unallocated,
    totals: { actual: totalActual, estimated: totalEstimated, unreconciledLines, recordedMissingCost },
  };
}
