/**
 * Partner positions — THE partner calculation (pure, no I/O). Every partner page reads this.
 *
 * A fattening farm makes or loses money when an animal leaves: sold (price) or dead (nothing).
 * Until then feed, labour and every other running cost is part of what the animal costs; it is
 * not a loss. So the farm's result has two parts:
 *
 *   realized  — animals that left:  price − its full cost
 *   estimate  — animals on the farm: today's value (weight × market price) − its full cost
 *
 *   full cost = purchase + costs recorded on the animal (vet, its own feed, its own expenses)
 *             + running costs × its days on the farm ÷ all animals' days on the farm
 *   running costs = everything the accounts expense that is not tied to one animal
 *                   (herd feed eaten, labour, electricity, transport, depreciation …)
 *
 * The two parts add up to the accounts: retained earnings + profit paid out + (herd value −
 * livestock at cost). Only the realized part can be paid out; the estimate is shown as one.
 *
 * Split (owner's rules, per part and per animal):
 *   profit → management fee first; fixed-share partners (e.g. a labour partner's 50%) take their
 *            percent; the rest goes to the other partners by TAKA × DAYS (capital-days) —
 *            money that was in the farm longer earns more, and a partner who joined later shares
 *            only from the day their money came in.
 *   loss   → 100% to the partners who bear loss, fixed-share ones by their percent and the rest
 *            by taka × days. A partner who does not bear loss is never charged.
 * A sold/dead animal's result is split by taka × days up to the day it left; the estimate by
 * taka × days up to today.
 */

export type PositionPartner = {
  id: string;
  name: string;
  partnerType: "capital" | "labor" | "hybrid";
  shareMode: "auto" | "manual";
  fixedPct: number;              // manual partners: percent of profit (and of loss if they bear it)
  bearsLoss: boolean;
  joinedAt: string;              // YYYY-MM-DD
  laborValueMonthly: number | null;
  cliffMonths: number;
};

export type PositionTxn = { partnerId: string; type: string; amount: number; date: string };

export type PositionAnimal = {
  id: string;
  tag: string;
  status: "active" | "sold" | "dead";
  purchaseDate: string;
  endDate: string | null;        // sold / died (null while on the farm)
  purchasePrice: number;
  ownCost: number;               // vet, feed and expenses recorded on this animal
  salePrice: number | null;      // sold: price; dead: 0
  valueToday: number | null;     // on the farm: weight × market price (estimate); null = unknown
};

export type PositionInput = {
  asOf: string;
  partners: PositionPartner[];
  txns: PositionTxn[];
  feePct: number;
  runningCosts: number;          // all-time, from the accounting engine
  animals: PositionAnimal[];
  marketPricePerKg: number | null;
};

export type AnimalResult = PositionAnimal & { days: number; runningShare: number; fullCost: number; result: number };

export type PartnerPosition = {
  id: string;
  name: string;
  partnerType: PositionPartner["partnerType"];
  shareMode: PositionPartner["shareMode"];
  bearsLoss: boolean;
  capitalIn: number;
  capitalOut: number;
  netCapital: number;
  laborValue: number;
  capitalDays: number;
  profitPct: number;             // of the farm's profit today (after the fee)
  lossPct: number;               // of the farm's loss today
  realizedShare: number;
  estimateShare: number;
  profitReceived: number;
  /** capital + labour value + share of realized + share of estimate − profit already paid */
  balance: number;
  /** realized profit share not yet paid out (the only amount that can be distributed) */
  distributable: number;
};

export type FarmPosition = {
  asOf: string;
  capitalIn: number;
  capitalOut: number;
  runningCosts: number;
  costPerHeadDay: number;
  herdCost: number;              // full cost of the animals on the farm
  herdValue: number;             // estimate (animals without a value count at cost)
  herdValued: boolean;           // every animal on the farm has a value
  realized: number;
  estimate: number;
  total: number;
  fee: number;                   // management fee on the positive parts
  profitPaid: number;
  unallocated: number;           // could not be allocated (no eligible partner)
  animals: AnimalResult[];
  marketPricePerKg: number | null;
};

const DAY = 86400000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

function addMonths(date: string, n: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Labour value as dated contributions: one month's value on each month after the cliff. */
function laborContributions(p: PositionPartner, asOf: string): { amount: number; date: string }[] {
  if (p.partnerType === "capital" || !p.laborValueMonthly || p.laborValueMonthly <= 0) return [];
  const out: { amount: number; date: string }[] = [];
  for (let m = Math.max(1, p.cliffMonths); ; m++) {
    const date = addMonths(p.joinedAt, m);
    if (date > asOf) break;
    // the cliff month releases the months before it too
    out.push({ amount: m === Math.max(1, p.cliffMonths) ? p.laborValueMonthly * m : p.laborValueMonthly, date });
  }
  return out;
}

/** Taka × days of each partner's money up to `at` (the day money came in counts). */
export function capitalDays(partners: PositionPartner[], txns: PositionTxn[], at: string): Record<string, number> {
  const w: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));
  const end = dayNum(at);
  for (const t of txns) {
    if (!(t.partnerId in w) || t.date > at) continue;
    const days = end - dayNum(t.date) + 1;
    if (t.type === "investment") w[t.partnerId] += t.amount * days;
    else if (t.type === "withdrawal") w[t.partnerId] -= t.amount * days;
  }
  for (const p of partners) for (const c of laborContributions(p, at)) w[p.id] += c.amount * (end - dayNum(c.date) + 1);
  for (const k of Object.keys(w)) w[k] = Math.max(0, w[k]);
  return w;
}

/** Percent of a profit (after the fee) and of a loss for each partner, with weights at one date. */
export function splitPercents(partners: PositionPartner[], weights: Record<string, number>): { profit: Record<string, number>; loss: Record<string, number> } {
  const profit: Record<string, number> = {};
  const loss: Record<string, number> = {};
  for (const p of partners) { profit[p.id] = 0; loss[p.id] = 0; }

  const byWeight = (pool: number, group: PositionPartner[], into: Record<string, number>) => {
    const total = group.reduce((s, p) => s + (weights[p.id] ?? 0), 0);
    if (pool <= 0 || total <= 0) return false;
    for (const p of group) into[p.id] += (pool * (weights[p.id] ?? 0)) / total;
    return true;
  };

  // profit
  const manual = partners.filter((p) => p.shareMode === "manual");
  const auto = partners.filter((p) => p.shareMode !== "manual");
  const manualTotal = Math.min(100, manual.reduce((s, p) => s + Math.max(0, p.fixedPct), 0));
  const scale = manualTotal > 0 ? manualTotal / manual.reduce((s, p) => s + Math.max(0, p.fixedPct), 0) : 0;
  for (const p of manual) profit[p.id] = Math.max(0, p.fixedPct) * scale;
  if (!byWeight(100 - manualTotal, auto, profit) && manualTotal > 0 && manualTotal < 100) {
    // nobody to take the rest: the fixed shares take it in proportion
    for (const p of manual) profit[p.id] = (profit[p.id] / manualTotal) * 100;
  }

  // loss: only partners who bear loss; always 100% when anybody can bear it
  const bearers = partners.filter((p) => p.bearsLoss);
  const manualBearers = bearers.filter((p) => p.shareMode === "manual");
  const autoBearers = bearers.filter((p) => p.shareMode !== "manual");
  const mbRaw = manualBearers.reduce((s, p) => s + Math.max(0, p.fixedPct), 0);
  const mb = Math.min(100, mbRaw);
  const hasAutoWeight = autoBearers.some((p) => (weights[p.id] ?? 0) > 0);
  if (hasAutoWeight) {
    for (const p of manualBearers) loss[p.id] = mbRaw > 0 ? (Math.max(0, p.fixedPct) * mb) / mbRaw : 0;
    byWeight(100 - mb, autoBearers, loss);
  } else if (mbRaw > 0) {
    for (const p of manualBearers) loss[p.id] = (Math.max(0, p.fixedPct) / mbRaw) * 100;
  } else {
    // nobody marked as bearing loss: the money partners carry it (a loss cannot vanish)
    byWeight(100, auto, loss);
  }
  return { profit, loss };
}

export function buildPartnerPositions(input: PositionInput): { farm: FarmPosition; partners: PartnerPosition[] } {
  const { asOf, partners, txns, feePct } = input;
  const feeRate = Math.max(0, feePct) / 100;

  // ── animals: full cost by days on the farm ──
  const days = (a: PositionAnimal) => Math.max(1, dayNum(a.endDate ?? asOf) - dayNum(a.purchaseDate) + 1);
  const totalDays = input.animals.reduce((s, a) => s + days(a), 0);
  const perDay = totalDays > 0 ? input.runningCosts / totalDays : 0;
  const animals: AnimalResult[] = input.animals.map((a) => {
    const d = days(a);
    const runningShare = perDay * d;
    const fullCost = a.purchasePrice + a.ownCost + runningShare;
    const worth = a.status === "active" ? (a.valueToday ?? fullCost) : (a.salePrice ?? 0);
    return { ...a, days: d, runningShare, fullCost, result: worth - fullCost };
  });
  // running costs with no animal at all (e.g. before the first purchase) are a realized loss
  const orphanRunning = totalDays > 0 ? 0 : input.runningCosts;

  // ── split ──
  const alloc: Record<string, { realized: number; estimate: number }> = Object.fromEntries(partners.map((p) => [p.id, { realized: 0, estimate: 0 }]));
  let fee = 0;
  let unallocated = 0;
  const allocate = (amount: number, at: string, part: "realized" | "estimate") => {
    if (Math.abs(amount) < 1e-9) return;
    let net = amount;
    if (amount > 0) { const f = amount * feeRate; fee += f; net -= f; }
    const pct = splitPercents(partners, capitalDays(partners, txns, at));
    const table = amount > 0 ? pct.profit : pct.loss;
    const sum = Object.values(table).reduce((s, x) => s + x, 0);
    for (const p of partners) alloc[p.id][part] += (net * table[p.id]) / 100;
    unallocated += net * (1 - sum / 100);
  };
  for (const a of animals) if (a.status !== "active") allocate(a.result, a.endDate ?? asOf, "realized");
  allocate(-orphanRunning, asOf, "realized");
  const estimate = animals.filter((a) => a.status === "active").reduce((s, a) => s + a.result, 0);
  allocate(estimate, asOf, "estimate");

  const weightsToday = capitalDays(partners, txns, asOf);
  const pctToday = splitPercents(partners, weightsToday);

  const positions: PartnerPosition[] = partners.map((p) => {
    const mine = txns.filter((t) => t.partnerId === p.id && t.date <= asOf);
    const sum = (type: string) => mine.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
    const capitalIn = sum("investment");
    const capitalOut = sum("withdrawal");
    const profitReceived = sum("profit");
    const laborValue = laborContributions(p, asOf).reduce((s, c) => s + c.amount, 0);
    const realizedShare = alloc[p.id].realized;
    const estimateShare = alloc[p.id].estimate;
    return {
      id: p.id, name: p.name, partnerType: p.partnerType, shareMode: p.shareMode, bearsLoss: p.bearsLoss,
      capitalIn: r2(capitalIn), capitalOut: r2(capitalOut), netCapital: r2(capitalIn - capitalOut), laborValue: r2(laborValue),
      capitalDays: Math.round(weightsToday[p.id] ?? 0),
      profitPct: r2(pctToday.profit[p.id]), lossPct: r2(pctToday.loss[p.id]),
      realizedShare: r2(realizedShare), estimateShare: r2(estimateShare), profitReceived: r2(profitReceived),
      balance: r2(capitalIn - capitalOut + laborValue + realizedShare + estimateShare - profitReceived),
      distributable: r2(Math.max(0, realizedShare - profitReceived)),
    };
  });

  const active = animals.filter((a) => a.status === "active");
  const realized = animals.filter((a) => a.status !== "active").reduce((s, a) => s + a.result, 0) - orphanRunning;
  return {
    farm: {
      asOf,
      capitalIn: r2(positions.reduce((s, p) => s + p.capitalIn, 0)),
      capitalOut: r2(positions.reduce((s, p) => s + p.capitalOut, 0)),
      runningCosts: r2(input.runningCosts),
      costPerHeadDay: r2(perDay),
      herdCost: r2(active.reduce((s, a) => s + a.fullCost, 0)),
      herdValue: r2(active.reduce((s, a) => s + (a.valueToday ?? a.fullCost), 0)),
      herdValued: active.every((a) => a.valueToday != null),
      realized: r2(realized),
      estimate: r2(estimate),
      total: r2(realized + estimate),
      fee: r2(fee),
      profitPaid: r2(positions.reduce((s, p) => s + p.profitReceived, 0)),
      unallocated: r2(unallocated),
      animals,
      marketPricePerKg: input.marketPricePerKg,
    },
    partners: positions,
  };
}
