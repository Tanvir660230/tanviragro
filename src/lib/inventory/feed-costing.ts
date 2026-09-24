/**
 * Feed costing rules shared by pages and reports (pure functions, no I/O).
 *
 *  - Stock value and cost use the cumulative weighted-average cost (WAC) of IN movements
 *    with a known cost — the same rule as the database function inventory_unit_cost_as_of.
 *  - Units are explicit: a price per piece is never multiplied by kilograms. A piece item
 *    converts to kg only when its kg_per_unit is set; otherwise the value is "unknown".
 *  - ESTIMATED cost (ration plan × WAC) and ACTUAL cost (recorded consumption rows) are
 *    separate numbers and must be labelled separately. Neither may be added to the other.
 */

export type CostedInRow = { qty: number; unit_cost: number | null };

/** WAC of IN rows with a known cost; null when no row has a known cost. */
export function weightedAverageUnitCost(inRows: CostedInRow[]): number | null {
  let qty = 0;
  let value = 0;
  for (const r of inRows) {
    if (r.unit_cost == null || !(r.qty > 0)) continue;
    qty += r.qty;
    value += r.qty * r.unit_cost;
  }
  return qty > 0 ? value / qty : null;
}

/**
 * item_id → WAC over IN rows with a known cost. Replaces the old "most recent purchase
 * price" map, which revalued all past feed at the latest price (P-04).
 */
export function buildWacUnitCostMap(
  rows: ReadonlyArray<{ item_id: string; qty?: number | null; unit_cost: number | null }>
): Record<string, number> {
  const acc: Record<string, { qty: number; value: number }> = {};
  for (const r of rows) {
    const qty = Number(r.qty);
    if (r.unit_cost == null || !(qty > 0)) continue;
    const a = (acc[r.item_id] ??= { qty: 0, value: 0 });
    a.qty += qty;
    a.value += qty * Number(r.unit_cost);
  }
  const out: Record<string, number> = {};
  for (const [id, a] of Object.entries(acc)) if (a.qty > 0) out[id] = a.value / a.qty;
  return out;
}

/** Converts kg to the item's own unit; null when the conversion is unknown. */
export function kgToItemUnits(kg: number, unit: string, kgPerUnit: number | null | undefined): number | null {
  if (unit.trim().toLowerCase() === "kg") return kg;
  return kgPerUnit && kgPerUnit > 0 ? kg / kgPerUnit : null;
}

/** Cost of one kg of an item priced per its own unit; null when the conversion is unknown. */
export function costPerKg(unitCost: number | null, unit: string, kgPerUnit: number | null | undefined): number | null {
  if (unitCost == null) return null;
  if (unit.trim().toLowerCase() === "kg") return unitCost;
  return kgPerUnit && kgPerUnit > 0 ? unitCost / kgPerUnit : null;
}

export type EstimateLine = { item_id: string; kg: number };
export type ItemCostInfo = { unit: string; kgPerUnit: number | null; unitCost: number | null; name?: string };

/**
 * ESTIMATED daily feed cost from a ration plan. Lines whose cost cannot be known (no price,
 * or a piece item without kg_per_unit) are listed in `unknownItems` and excluded — the
 * total is then a lower bound and `complete` is false. Never a guessed number.
 */
export function estimateFeedCost(
  lines: EstimateLine[],
  items: Record<string, ItemCostInfo | undefined>
): { total: number; complete: boolean; unknownItems: string[] } {
  let total = 0;
  const unknownItems: string[] = [];
  for (const l of lines) {
    if (!(l.kg > 0)) continue;
    const info = items[l.item_id];
    const perKg = info ? costPerKg(info.unitCost, info.unit, info.kgPerUnit) : null;
    if (perKg == null) {
      unknownItems.push(info?.name ?? l.item_id);
      continue;
    }
    total += l.kg * perKg;
  }
  return { total, complete: unknownItems.length === 0, unknownItems };
}

export type ActualFeedRow = {
  recorded_at: string;           // YYYY-MM-DD…
  qty: number;
  unit_cost: number | null;
  cattle_id: string | null;
};
export type AnimalPresence = { id: string; from: string; to: string | null }; // inclusive dates

/**
 * ACTUAL feed cost of one animal from recorded consumption rows.
 * A row with cattle_id belongs to that animal only. A herd row (cattle_id NULL) is shared
 * equally among the animals present on its date (head-day allocation). Rows without a
 * known cost are counted in `rowsMissingCost`, never valued at 0 or at a later price.
 */
export function allocateActualFeedCost(
  rows: ActualFeedRow[],
  animals: AnimalPresence[],
  animalId: string
): { cost: number; rowsMissingCost: number; rowsCounted: number } {
  let cost = 0;
  let rowsMissingCost = 0;
  let rowsCounted = 0;
  for (const { row, share } of animalFeedShares(rows, animals, animalId)) {
    rowsCounted++;
    if (row.unit_cost == null) { rowsMissingCost++; continue; }
    cost += row.qty * row.unit_cost * share;
  }
  return { cost, rowsMissingCost, rowsCounted };
}

/** The rows that belong to one animal and the fraction of each (1 for its own rows). */
export function animalFeedShares<R extends ActualFeedRow>(
  rows: R[],
  animals: AnimalPresence[],
  animalId: string
): { row: R; share: number }[] {
  const me = animals.find((a) => a.id === animalId);
  const out: { row: R; share: number }[] = [];
  for (const r of rows) {
    const day = r.recorded_at.slice(0, 10);
    if (r.cattle_id) {
      if (r.cattle_id === animalId) out.push({ row: r, share: 1 });
      continue;
    }
    if (!me || !isPresent(me, day)) continue;
    const present = animals.filter((a) => isPresent(a, day)).length;
    if (present > 0) out.push({ row: r, share: 1 / present });
  }
  return out;
}

/**
 * Each animal's share of HERD feeding (rows without cattle_id): a day's recorded cost is
 * split equally among the animals present that day. Rows without a known cost add nothing.
 * Used by management views (valuation, cost basis) — not by the accounting journal, where
 * herd feed is an expense of the period.
 */
export function herdFeedCostShares(rows: ActualFeedRow[], animals: AnimalPresence[]): Record<string, number> {
  const valueByDay = new Map<string, number>();
  for (const r of rows) {
    if (r.cattle_id || r.unit_cost == null) continue;
    const day = r.recorded_at.slice(0, 10);
    valueByDay.set(day, (valueByDay.get(day) ?? 0) + r.qty * r.unit_cost);
  }
  const out: Record<string, number> = {};
  for (const [day, value] of valueByDay) {
    const present = animals.filter((a) => isPresent(a, day));
    for (const a of present) out[a.id] = (out[a.id] ?? 0) + value / present.length;
  }
  return out;
}

function isPresent(a: AnimalPresence, day: string): boolean {
  return a.from.slice(0, 10) <= day && (a.to == null || day <= a.to.slice(0, 10));
}

/**
 * Days with recorded feeding: net quantity > 0 after audited reversals (negative rows).
 * A day whose consumption was fully reversed counts as not recorded.
 */
export function recordedFeedDays(rows: { recorded_at: string; qty: number }[]): string[] {
  const net = new Map<string, number>();
  for (const r of rows) {
    const d = r.recorded_at.slice(0, 10);
    net.set(d, (net.get(d) ?? 0) + Number(r.qty));
  }
  return [...net].filter(([, q]) => q > 0.0001).map(([d]) => d);
}

/**
 * Dates in [from, to] (inclusive, YYYY-MM-DD) with no recorded feeding. These are shown
 * as NOT RECORDED — the system never back-fills them with an estimate.
 */
export function daysNotRecorded(from: string, to: string, recordedDays: Iterable<string>): string[] {
  const have = new Set([...recordedDays].map((d) => d.slice(0, 10)));
  const out: string[] = [];
  const end = new Date(`${to.slice(0, 10)}T00:00:00Z`);
  for (let d = new Date(`${from.slice(0, 10)}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (!have.has(key)) out.push(key);
  }
  return out;
}
