/**
 * Splitting one price over several animals — a group bought, or sold, together at one price.
 *
 * The group's total is the fact (it is what was paid / received); each animal's share is derived
 * from it, and the shares ALWAYS add up to the total exactly (largest-remainder rounding, never a
 * leftover taka). Every animal then carries its own cost / sale value, so profit per animal,
 * the Money page and the partners' split read one figure per animal as before.
 *
 * How a share is decided (the basis), best evidence first:
 *   1. weight MEASURED at the deal (purchase or sale): cattle are traded by size, so a 210 kg
 *      animal in a pair that cost ৳171,000 carries 210/410 of it.
 *   2. a weigh-in: the first day on or after the purchase that EVERY animal of the group was
 *      weighed (measured). Within 30 days it beats a guessed purchase weight; later, animals
 *      grow at different rates, so a guess made at the deal is used first.
 *   3. weight ESTIMATED at the deal (what the price was agreed on), labelled as an estimate.
 *   4. equal shares, marked PROVISIONAL, until 1–3 exists (one price, no evidence of a
 *      difference — nothing better can be claimed; the app asks for a weigh-in).
 *   5. manual: the owner types each price (e.g. the seller priced them one by one).
 */

export type SplitMethod = "weight" | "equal" | "manual";

export type SplitLine = {
  id: string;
  /** the weight used for a "weight" split */
  weightKg?: number | null;
  /** the amount typed for a "manual" split */
  amount?: number | null;
};

export type SplitResult =
  | { ok: true; amounts: Record<string, number>; unit: number }
  | { ok: false; error: SplitError; detail?: number };

export type SplitError = "no_animals" | "bad_total" | "missing_weight" | "bad_amount" | "sum_mismatch" | "duplicate";

/** Money is kept in whole taka when the total is whole, else in paisa. */
export function moneyUnit(total: number): number {
  return Number.isInteger(Math.round(total * 100) / 100) ? 1 : 0.01;
}

const EPS = 0.005;

/**
 * Split `total` over `lines`. Shares add up to `total` exactly.
 * weight → by each line's weightKg (all must be > 0); equal → the same share each;
 * manual → the typed amounts, which must already add up to the total.
 */
export function splitTotal(total: number, lines: SplitLine[], method: SplitMethod): SplitResult {
  if (!lines.length) return { ok: false, error: "no_animals" };
  if (new Set(lines.map((l) => l.id)).size !== lines.length) return { ok: false, error: "duplicate" };
  if (!Number.isFinite(total) || total < 0) return { ok: false, error: "bad_total" };
  const unit = moneyUnit(total);

  if (method === "manual") {
    const amounts: Record<string, number> = {};
    let sum = 0;
    for (const l of lines) {
      const a = Number(l.amount);
      if (l.amount == null || !Number.isFinite(a) || a < 0) return { ok: false, error: "bad_amount" };
      amounts[l.id] = round2(a);
      sum += amounts[l.id];
    }
    const diff = round2(total - sum);
    if (Math.abs(diff) > EPS) return { ok: false, error: "sum_mismatch", detail: diff };
    return { ok: true, amounts, unit };
  }

  let weights: number[];
  if (method === "weight") {
    weights = lines.map((l) => Number(l.weightKg));
    if (weights.some((w) => !Number.isFinite(w) || w <= 0)) return { ok: false, error: "missing_weight" };
  } else {
    weights = lines.map(() => 1);
  }
  const shares = largestRemainder(Math.round(total / unit), weights);
  const amounts: Record<string, number> = {};
  lines.forEach((l, i) => { amounts[l.id] = round2(shares[i] * unit); });
  return { ok: true, amounts, unit };
}

/**
 * Integer units split in proportion to weights; the units left after rounding down go to the
 * largest remainders (ties: the earlier line), so the parts always add up to `units`.
 */
export function largestRemainder(units: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (units * w) / total);
  const floor = exact.map((x) => Math.floor(x + 1e-9));
  let left = units - floor.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - floor[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floor[order[k].i] += 1;
  return floor;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

// ── which basis a purchase group can use ────────────────────────────────────

export type MemberEvidence = {
  id: string;
  initialWeightKg: number | null;
  initialWeightType: "measured" | "estimated" | "unknown" | null;
  /** weighings after purchase */
  logs: { date: string; kg: number; type: "measured" | "estimated" }[];
};

export type Basis =
  | { kind: "purchase_weight"; method: "weight"; estimated: boolean; weights: Record<string, number> }
  | { kind: "weigh_in"; method: "weight"; date: string; weights: Record<string, number> }
  | { kind: "equal"; method: "equal"; provisional: true };

/** Weight at purchase for every animal (measured or estimated, not "unknown"), or null. */
export function purchaseWeights(members: MemberEvidence[]): { weights: Record<string, number>; estimated: boolean } | null {
  const weights: Record<string, number> = {};
  let estimated = false;
  for (const m of members) {
    const kg = Number(m.initialWeightKg);
    if (!(kg > 0) || m.initialWeightType === "unknown" || m.initialWeightType == null) return null;
    weights[m.id] = kg;
    if (m.initialWeightType === "estimated") estimated = true;
  }
  return { weights, estimated };
}

/** Days on which EVERY animal has a measured weighing, oldest first, with those weights. */
export function weighInDays(members: MemberEvidence[]): { date: string; weights: Record<string, number> }[] {
  if (!members.length) return [];
  const byDay = new Map<string, Record<string, number>>();
  for (const m of members) {
    for (const l of m.logs) {
      if (l.type !== "measured" || !(l.kg > 0)) continue;
      const day = l.date.slice(0, 10);
      const w = byDay.get(day) ?? {};
      w[m.id] = l.kg; // the later log of a day wins (logs arrive oldest first)
      byDay.set(day, w);
    }
  }
  return [...byDay.entries()]
    .filter(([, w]) => members.every((m) => w[m.id] > 0))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, weights]) => ({ date, weights }));
}

/** A weigh-in this close to the purchase is better evidence than a guessed purchase weight. */
export const NEAR_WEIGH_IN_DAYS = 30;

/** The best basis available now (see the order at the top of this file). */
export function bestBasis(members: MemberEvidence[], purchaseDate: string): Basis {
  const atPurchase = purchaseWeights(members);
  if (atPurchase && !atPurchase.estimated) return { kind: "purchase_weight", method: "weight", estimated: false, weights: atPurchase.weights };
  const first = weighInDays(members).find((d) => d.date >= purchaseDate.slice(0, 10));
  const near = first && daysApart(purchaseDate, first.date) <= NEAR_WEIGH_IN_DAYS;
  if (first && (near || !atPurchase)) return { kind: "weigh_in", method: "weight", date: first.date, weights: first.weights };
  if (atPurchase) return { kind: "purchase_weight", method: "weight", estimated: true, weights: atPurchase.weights };
  return { kind: "equal", method: "equal", provisional: true };
}

export function daysApart(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86400000);
}

/** Split a group total on a basis; lines keep the members' order. */
export function splitOnBasis(total: number, memberIds: string[], basis: Basis): SplitResult {
  if (basis.method === "equal") return splitTotal(total, memberIds.map((id) => ({ id })), "equal");
  return splitTotal(total, memberIds.map((id) => ({ id, weightKg: basis.weights[id] })), "weight");
}

/** Stored label of a basis (group.basis), e.g. "purchase_weight", "weigh_in:2026-10-02", "equal", "manual". */
export function basisKey(b: Basis | { kind: "manual" }): string {
  return b.kind === "weigh_in" ? `weigh_in:${b.date}` : b.kind === "purchase_weight" && b.estimated ? "purchase_weight_estimated" : b.kind;
}

// ── profit per animal in a group ─────────────────────────────────────────────

/** Profit of each animal = its sale share − its full cost (purchase share + feed + own costs). */
export function profitPerAnimal(lines: { id: string; sale: number; cost: number }[]): { id: string; profit: number }[] {
  return lines.map((l) => ({ id: l.id, profit: round2(l.sale - l.cost) }));
}
