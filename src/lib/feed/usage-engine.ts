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
export type RuleType = "weight_share" | "pct_live_weight" | "per_head";

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
};

export type Period = {
  id: string;
  targetType: "item" | "recipe";
  targetName: string;
  status: "open" | "closed" | "unreconciled";
  startDate: string;
  endDate: string | null;
  ruleType: RuleType;
  ruleValue: number | null;
  lines: PeriodLine[];
};

/** Consumption rows recorded outside periods (manual / legacy). qty < 0 = audited reversal. */
export type RecordedRow = { date: string; itemId: string; itemName?: string; unit?: string; qty: number; unitCost: number | null; cattleId: string | null };

export type AnimalFeed = { actual: number; estimated: number; actualQtyByItem: Record<string, number>; actualValueByItem: Record<string, number>; estimatedQtyByItem: Record<string, number> };

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

/** An animal's need on a day, in the ITEM's unit when the rule allows it, else a weight share. */
export function need(a: Animal, day: string, rule: RuleType, ruleValue: number | null, line: Pick<PeriodLine, "unit" | "kgPerUnit" | "share">): { qty: number | null; share: number } {
  const w = weightOn(a, day).kg;
  if (rule === "per_head" && ruleValue) return { qty: ruleValue * line.share, share: ruleValue * line.share };
  if (rule === "pct_live_weight" && ruleValue) {
    const kg = (w * ruleValue) / 100 * line.share;
    const unitKg = line.unit.trim().toLowerCase() === "kg" ? 1 : line.kgPerUnit;
    return { qty: unitKg ? kg / unitKg : null, share: kg };
  }
  return { qty: null, share: w };
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
function blankAnimal(): AnimalFeed { return { actual: 0, estimated: 0, actualQtyByItem: {}, actualValueByItem: {}, estimatedQtyByItem: {} }; }

export function computeFeedSnapshot(input: {
  asOf: string;
  periods: Period[];
  animals: Animal[];
  recorded: RecordedRow[];
  wac: Record<string, number | null>;
}): FeedSnapshot {
  const { asOf, periods, animals, recorded, wac } = input;
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
  function spreadDay(day: string, qty: number, value: number, weights: Map<string, number>, kind: "actual" | "estimated", itemId: string) {
    const total = [...weights.values()].reduce((s, w) => s + w, 0);
    if (total <= 0) { unallocated += value; return; }
    for (const [id, w] of weights) {
      const f = perAnimal[id];
      if (kind === "actual") {
        f.actual += value * (w / total);
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
      const perDay = days.map((day) => {
        const m = new Map<string, number>();
        let ruleQty = 0;
        let ruleComplete = p.ruleType !== "weight_share";
        for (const a of animals) {
          if (!isPresent(a, day)) continue;
          const n = need(a, day, p.ruleType, p.ruleValue, l);
          m.set(a.id, n.share);
          if (n.qty == null) ruleComplete = false; else ruleQty += n.qty;
        }
        return { day, weights: m, ruleQty: ruleComplete ? ruleQty : null };
      });
      const ruleTotal = perDay.every((d) => d.ruleQty != null) ? perDay.reduce((s, d) => s + (d.ruleQty ?? 0), 0) : null;
      const bucket = itemBucket(l);

      if (p.status === "open") {
        // RUNNING ESTIMATE: rule quantity, else learned daily usage, else nothing
        const learned = learnedAll[l.itemId];
        const basis: LineResult["estimateBasis"] = ruleTotal != null ? "rule" : learned ? "learned" : "none";
        const totalQty = basis === "rule" ? ruleTotal! : basis === "learned" ? learned * days.length : null;
        const cost = wac[l.itemId] ?? null;
        const value = totalQty != null && cost != null ? totalQty * cost : null;
        if (totalQty != null) {
          const shareSum = perDay.reduce((s, d) => s + [...d.weights.values()].reduce((x, y) => x + y, 0), 0);
          for (const d of perDay) {
            const dayShare = basis === "rule" ? (d.ruleQty ?? 0) / (ruleTotal || 1) : ([...d.weights.values()].reduce((x, y) => x + y, 0) / (shareSum || 1));
            const q = totalQty * dayShare;
            const v = (value ?? 0) * dayShare;
            spreadDay(d.day, q, v, d.weights, "estimated", l.itemId);
            month(d.day).estimated += v;
          }
          bucket.estimatedQty += totalQty;
          bucket.estimatedValue += value ?? 0;
          totalEstimated += value ?? 0;
        }
        lines.push({
          periodId: p.id, itemId: l.itemId, itemName: l.itemName, unit: l.unit, status: "estimated", days: days.length,
          qty: totalQty, value, dailyQty: totalQty != null ? totalQty / days.length : null,
          expectedQty: null, varianceQty: null, variancePct: null, gapQty: 0, estimateBasis: basis,
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
        spreadDay(d.day, qty * dayShare, value * dayShare, d.weights, "actual", l.itemId);
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
    month(r.date).actual += value;
    const b = itemBucket({ itemId: r.itemId, itemName: r.itemName ?? r.itemId, unit: r.unit ?? "" });
    b.actualQty += r.qty;
    b.actualValue += value;
    if (r.cattleId) {
      const f = (perAnimal[r.cattleId] ??= blankAnimal());
      f.actual += value;
      f.actualQtyByItem[r.itemId] = (f.actualQtyByItem[r.itemId] ?? 0) + r.qty;
      f.actualValueByItem[r.itemId] = (f.actualValueByItem[r.itemId] ?? 0) + value;
      continue;
    }
    const weights = new Map<string, number>();
    for (const a of animals) if (isPresent(a, r.date)) weights.set(a.id, weightOn(a, r.date).kg || 1);
    spreadDay(r.date, r.qty, value, weights, "actual", r.itemId);
  }

  return {
    asOf, perAnimal, lines, byMonth, byItem, learnedDaily: learnedAll, unallocated,
    totals: { actual: totalActual, estimated: totalEstimated, unreconciledLines, recordedMissingCost },
  };
}
