/**
 * Partner positions — THE partner calculation (pure, no I/O). Every partner page reads this.
 *
 * A fattening farm makes or loses money when an animal leaves: sold (price) or dead (nothing).
 * Until then feed, labour and every other running cost is part of what the animal costs.
 *
 *   realized — animals that left:  price − full cost      (never changes after it left)
 *   estimate — animals on the farm: value today − full cost (weight × market price)
 *
 *   full cost = purchase + costs recorded on the animal (vet, its own feed, its own expenses)
 *             + its share of each day's running costs, shared among the animals on the farm
 *               THAT day (herd feed, labour, electricity, depreciation …)
 *   A day's running cost with no animal on the farm is a realized loss of that day.
 *
 * Realized + estimate = the accounts' figure (retained earnings + profit paid + herd value −
 * livestock at cost). Only realized profit can be paid out.
 *
 * Split — on the NET of each part (realized, estimate): a loss on one animal is set against the
 * profit on another before anybody's share is worked out.
 *   • the net is spread over the animals' days; the days are cut wherever a share rule, the
 *     management fee, a partner joining or leaving changes, and each piece is split with what
 *     was in force then ("50% → 40% from 1 Oct": days before 1 Oct at 50%, after at 40%);
 *   • profit: fee first; fixed-share partners take their %; the rest by TAKA × DAYS — each
 *     partner's money in the farm during those days (withdrawn money stops counting);
 *   • loss: 100% to the partners who bear loss (fixed ones by their %, the rest by taka × days).
 */

export type PositionPartner = {
  id: string;
  name: string;
  partnerType: "capital" | "labor" | "hybrid";
  joinedAt: string;              // YYYY-MM-DD
  leftAt: string | null;         // no share from this day
  laborValueMonthly: number | null;
  cliffMonths: number;
  /** the setting used when the partner has no share rule yet (from the partner row) */
  shareMode: "auto" | "manual";
  fixedPct: number;
  bearsLoss: boolean;
};

export type ShareRule = { partnerId: string; from: string; shareMode: "auto" | "manual"; fixedPct: number; bearsLoss: boolean };
export type FeeRate = { from: string; pct: number };
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
  rules: ShareRule[];
  feeRates: FeeRate[];
  txns: PositionTxn[];
  /** running costs by day (all dated rows the accounts expense that are not on one animal) */
  dailyCosts: { date: string; amount: number }[];
  animals: PositionAnimal[];
  marketPricePerKg: number | null;
  /** cycles the owner closed: results that became final on or before `closedOn` are settled there */
  cycles?: { id: string; closedOn: string }[];
};

export type CycleResult = { id: string; closedOn: string; from: string | null; items: number; net: number; fee: number; shares: Record<string, number> };

export type AnimalResult = PositionAnimal & { days: number; runningShare: number; fullCost: number; result: number };

/** What a partner's share is on a given day (after rules, joining and leaving). */
export type Terms = { shareMode: "auto" | "manual"; fixedPct: number; bearsLoss: boolean; active: boolean };

export type PartnerPosition = {
  id: string;
  name: string;
  partnerType: PositionPartner["partnerType"];
  leftAt: string | null;
  terms: Terms;                  // today
  nextChange: (ShareRule & { kind: "rule" }) | null;   // a rule that starts after today
  capitalIn: number;
  capitalOut: number;
  netCapital: number;
  laborValue: number;
  capitalDays: number;           // over the days of the animals on the farm now
  profitPct: number;             // of a profit on the current herd (after the fee)
  lossPct: number;
  closedShare: number;           // share of the cycles already closed (never changes)
  realizedShare: number;         // closed cycles + the open cycle's final results
  estimateShare: number;         // what the animals on the farm add if sold today
  profitPaid: number;            // profit paid out
  advances: number;              // taken as an advance against profit (any time, any amount)
  profitReceived: number;        // profit paid + advances
  loanBalance: number;           // this partner's loan to the farm, still owed back
  balance: number;               // capital + labour + closed + open cycle if sold today − profit paid − advances
  distributable: number;         // settled profit not yet paid or advanced
  withdrawable: number;          // capital + settled profit − paid (the estimate is not counted)
  advanceOutstanding: number;    // advances and payouts beyond the settled profit (come off the next profit)
  overpaid: number;              // profit paid beyond the settled share (after later corrections)
};

export type FarmPosition = {
  asOf: string;
  capitalIn: number;
  capitalOut: number;
  runningCosts: number;
  costPerHeadDay: number;        // running costs ÷ head-days (for display)
  herdCost: number;
  herdValue: number;
  herdValued: boolean;
  realized: number;              // every final result (closed cycles + open cycle)
  openRealized: number;          // final results in the open cycle
  estimate: number;
  total: number;
  fee: number;
  feePctToday: number;
  profitPaid: number;
  loansFromPartners: number;
  unallocated: number;
  orphanRunning: number;         // running costs on days with no animal
  cycles: CycleResult[];
  openCycleFrom: string | null;  // the open cycle starts the day after the last close
  animals: AnimalResult[];
  marketPricePerKg: number | null;
};

const DAY = 86400000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
const dayStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Round every share to paisa so that they add up exactly to `target`: every share is rounded down,
 * and the paisa left over go one each to the shares with the largest remainders.
 */
function roundShares(shares: Record<string, number>, target: number): Record<string, number> {
  const keys = Object.keys(shares);
  const cents = keys.map((k) => shares[k] * 100);
  const floors = cents.map((c) => Math.floor(c + 1e-7));
  let left = Math.round(target * 100) - floors.reduce((s, x) => s + x, 0);
  const order = keys.map((_, i) => i).sort((a, b) => (cents[b] - floors[b]) - (cents[a] - floors[a]));
  for (let j = 0; left > 0 && j < order.length; j++, left--) floors[order[j]] += 1;
  return Object.fromEntries(keys.map((k, i) => [k, floors[i] / 100]));
}

function addMonths(date: string, n: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/** Labour value as dated contributions: one month's value on each month after the cliff. */
function laborContributions(p: PositionPartner, asOf: string): { amount: number; date: string }[] {
  if (p.partnerType === "capital" || !p.laborValueMonthly || p.laborValueMonthly <= 0) return [];
  const out: { amount: number; date: string }[] = [];
  const first = Math.max(1, p.cliffMonths);
  for (let m = first; ; m++) {
    const date = addMonths(p.joinedAt, m);
    if (date > asOf || (p.leftAt && date >= p.leftAt)) break;
    out.push({ amount: p.laborValueMonthly * (m === first ? m : 1), date });
  }
  return out;
}

/** The terms of each partner on day `d`. */
export function termsOn(partners: PositionPartner[], rules: ShareRule[], d: string): Record<string, Terms> {
  const out: Record<string, Terms> = {};
  for (const p of partners) {
    const rule = rules.filter((r) => r.partnerId === p.id && r.from <= d).sort((a, b) => a.from.localeCompare(b.from)).at(-1);
    const base = rule ?? { shareMode: p.shareMode, fixedPct: p.fixedPct, bearsLoss: p.bearsLoss };
    // a money partner shares through taka × days (nothing before their money comes in); a fixed
    // share starts on the join day. Nobody shares from the day they leave.
    const active = !(p.leftAt && d >= p.leftAt) && (base.shareMode !== "manual" || p.joinedAt <= d);
    out[p.id] = { shareMode: base.shareMode, fixedPct: Math.max(0, Number(base.fixedPct) || 0), bearsLoss: base.bearsLoss, active };
  }
  return out;
}

/** Taka × days of each partner's money in the farm between `from` and `to` (both included). */
export function capitalDays(partners: PositionPartner[], txns: PositionTxn[], from: string, to: string, asOf = to): Record<string, number> {
  const w: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));
  const a = dayNum(from), b = dayNum(to);
  const overlap = (date: string) => Math.max(0, b - Math.max(a, dayNum(date)) + 1);
  for (const t of txns) {
    if (!(t.partnerId in w) || t.date > to) continue;
    if (t.type === "investment") w[t.partnerId] += t.amount * overlap(t.date);
    else if (t.type === "withdrawal") w[t.partnerId] -= t.amount * overlap(t.date);
  }
  for (const p of partners) for (const c of laborContributions(p, asOf)) if (c.date <= to) w[p.id] += c.amount * overlap(c.date);
  for (const k of Object.keys(w)) w[k] = Math.max(0, w[k]);
  return w;
}

/** Percent of a profit (after the fee) and of a loss for each partner, given terms and weights. */
export function splitPercents(partners: PositionPartner[], terms: Record<string, Terms>, weights: Record<string, number>): { profit: Record<string, number>; loss: Record<string, number> } {
  const profit: Record<string, number> = {};
  const loss: Record<string, number> = {};
  for (const p of partners) { profit[p.id] = 0; loss[p.id] = 0; }
  const live = partners.filter((p) => terms[p.id]?.active);
  const t = (p: PositionPartner) => terms[p.id];

  const byWeight = (pool: number, group: PositionPartner[], into: Record<string, number>) => {
    const total = group.reduce((s, p) => s + (weights[p.id] ?? 0), 0);
    if (pool <= 0 || total <= 0) return false;
    for (const p of group) into[p.id] += (pool * (weights[p.id] ?? 0)) / total;
    return true;
  };

  // profit
  const manual = live.filter((p) => t(p).shareMode === "manual");
  const auto = live.filter((p) => t(p).shareMode !== "manual");
  const rawManual = manual.reduce((s, p) => s + t(p).fixedPct, 0);
  const manualTotal = Math.min(100, rawManual);
  for (const p of manual) profit[p.id] = rawManual > 0 ? (t(p).fixedPct * manualTotal) / rawManual : 0;
  if (!byWeight(100 - manualTotal, auto, profit) && manualTotal > 0 && manualTotal < 100) {
    for (const p of manual) profit[p.id] = (profit[p.id] / manualTotal) * 100;   // nobody else: the fixed shares take the rest
  }

  // loss: always 100% while anybody can carry it
  const bearers = live.filter((p) => t(p).bearsLoss);
  const manualB = bearers.filter((p) => t(p).shareMode === "manual");
  const autoB = bearers.filter((p) => t(p).shareMode !== "manual");
  const rawMB = manualB.reduce((s, p) => s + t(p).fixedPct, 0);
  const mb = Math.min(100, rawMB);
  if (autoB.some((p) => (weights[p.id] ?? 0) > 0)) {
    for (const p of manualB) loss[p.id] = rawMB > 0 ? (t(p).fixedPct * mb) / rawMB : 0;
    byWeight(100 - mb, autoB, loss);
  } else if (rawMB > 0) {
    for (const p of manualB) loss[p.id] = (t(p).fixedPct / rawMB) * 100;
  } else {
    byWeight(100, auto, loss);   // nobody marked as bearing loss: the money partners carry it (a loss cannot vanish)
  }
  return { profit, loss };
}

/** Days from `from` to `to` cut at every date where terms, the fee, or a partner's joining/leaving changes. */
function segments(from: string, to: string, cuts: string[]): { from: string; to: string; days: number }[] {
  const inside = [...new Set(cuts)].filter((c) => c > from && c <= to).sort();
  const out: { from: string; to: string; days: number }[] = [];
  let start = from;
  for (const c of inside) {
    const end = dayStr(dayNum(c) - 1);
    out.push({ from: start, to: end, days: dayNum(end) - dayNum(start) + 1 });
    start = c;
  }
  out.push({ from: start, to, days: dayNum(to) - dayNum(start) + 1 });
  return out.filter((s) => s.days > 0);
}

const feeOn = (rates: FeeRate[], d: string) => rates.filter((r) => r.from <= d).sort((a, b) => a.from.localeCompare(b.from)).at(-1)?.pct ?? 0;

export function buildPartnerPositions(input: PositionInput): { farm: FarmPosition; partners: PartnerPosition[] } {
  const { asOf, partners, txns, rules, feeRates } = input;

  // ── 1. running costs, day by day, among the animals on the farm that day ──
  const lastDay = (a: PositionAnimal) => (a.endDate && a.endDate < asOf ? a.endDate : asOf);
  const costByDay = new Map<number, number>();
  for (const c of input.dailyCosts) {
    if (c.date > asOf) continue;
    costByDay.set(dayNum(c.date), (costByDay.get(dayNum(c.date)) ?? 0) + c.amount);
  }
  const running: Record<string, number> = Object.fromEntries(input.animals.map((a) => [a.id, 0]));
  const orphanByDay: { date: string; amount: number }[] = [];
  const spans = input.animals.map((a) => ({ id: a.id, from: dayNum(a.purchaseDate), to: dayNum(lastDay(a)) }));
  for (const [d, amount] of costByDay) {
    const here = spans.filter((s) => s.from <= d && d <= s.to);
    if (here.length === 0) { orphanByDay.push({ date: dayStr(d), amount }); continue; }
    for (const s of here) running[s.id] += amount / here.length;
  }
  const runningTotal = [...costByDay.values()].reduce((s, x) => s + x, 0);
  const headDays = spans.reduce((s, x) => s + Math.max(0, x.to - x.from + 1), 0);

  const animals: AnimalResult[] = input.animals.map((a) => {
    const days = Math.max(1, dayNum(lastDay(a)) - dayNum(a.purchaseDate) + 1);
    const runningShare = running[a.id] ?? 0;
    const fullCost = a.purchasePrice + a.ownCost + runningShare;
    const worth = a.status === "active" ? (a.valueToday ?? fullCost) : (a.salePrice ?? 0);
    return { ...a, days, runningShare, fullCost, result: worth - fullCost };
  });

  // ── 2. split each result over its days, with the terms of each piece ──
  // cut only where something really changes (so "every taka-day counts the same" holds inside a piece)
  const same = (a: Record<string, Terms>, b: Record<string, Terms>) =>
    partners.every((p) => a[p.id].active === b[p.id].active && a[p.id].shareMode === b[p.id].shareMode && a[p.id].fixedPct === b[p.id].fixedPct && a[p.id].bearsLoss === b[p.id].bearsLoss);
  const candidates = [...new Set([...rules.map((r) => r.from), ...partners.map((p) => p.joinedAt), ...partners.flatMap((p) => (p.leftAt ? [p.leftAt] : []))])];
  const cuts = [
    ...candidates.filter((d) => !same(termsOn(partners, rules, d), termsOn(partners, rules, dayStr(dayNum(d) - 1)))),
    ...feeRates.map((f) => f.from),
  ];
  type Window = { from: string; to: string };
  type Item = { result: number; from: string; to: string };
  const overlapDays = (w: Window, s: Window) => Math.max(0, Math.min(dayNum(w.to), dayNum(s.to)) - Math.max(dayNum(w.from), dayNum(s.from)) + 1);
  /** taka × days of each partner during each window, added up (the money that financed those animals) */
  const windowWeights = (ws: Window[]) => {
    const total: Record<string, number> = Object.fromEntries(partners.map((p) => [p.id, 0]));
    for (const w of ws) {
      const cd = capitalDays(partners, txns, w.from, w.to, asOf);
      for (const k of Object.keys(total)) total[k] += cd[k];
    }
    return total;
  };
  const zero = () => Object.fromEntries(partners.map((p) => [p.id, 0])) as Record<string, number>;
  /**
   * Settle a group of results on its NET: the animals' results are added first, so a fixed share
   * (e.g. the labour partner's 50%) is a share of the net profit and a loss on one animal is set
   * against the profit on another. The net is spread over the animals' days, the days are cut where
   * the terms change, and each piece is split with the terms and the taka × days of the money in the
   * farm during those animals' days.
   */
  const settle = (items: Item[]): { shares: Record<string, number>; net: number; fee: number; unallocated: number } => {
    const shares = zero();
    const net = items.reduce((s, x) => s + x.result, 0);
    let fee = 0, unallocated = 0;
    if (Math.abs(net) < 1e-9 || items.length === 0) return { shares, net, fee, unallocated };
    const first = items.map((x) => x.from).sort()[0];
    const last = items.map((x) => x.to).sort().at(-1)!;
    const segs = segments(first, last, cuts);
    const animalDays = segs.map((seg) => items.reduce((s, x) => s + overlapDays(x, seg), 0));
    const totalAnimalDays = animalDays.reduce((s, x) => s + x, 0);
    segs.forEach((seg, i) => {
      if (!animalDays[i]) return;
      let piece = (net * animalDays[i]) / totalAnimalDays;
      if (piece > 0) { const f = (piece * feeOn(feeRates, seg.from)) / 100; fee += f; piece -= f; }
      const windows = items.map((x) => ({ from: x.from > seg.from ? x.from : seg.from, to: x.to < seg.to ? x.to : seg.to })).filter((w) => w.from <= w.to);
      const pct = splitPercents(partners, termsOn(partners, rules, seg.from), windowWeights(windows));
      const table = piece > 0 ? pct.profit : pct.loss;
      const sum = Object.values(table).reduce((s, x) => s + x, 0);
      for (const p of partners) shares[p.id] += (piece * table[p.id]) / 100;
      unallocated += piece * (1 - sum / 100);
    });
    return { shares: roundShares(shares, net - fee - unallocated), net, fee, unallocated };
  };

  // ── cycles: every result that became final falls in the cycle of the day it happened ──
  const closes = [...(input.cycles ?? [])].filter((c) => c.closedOn <= asOf).sort((a, b) => a.closedOn.localeCompare(b.closedOn));
  const cycleOf = (d: string) => { const i = closes.findIndex((c) => d <= c.closedOn); return i === -1 ? closes.length : i; };
  const finalItems: (Item & { end: string })[] = [
    ...animals.filter((a) => a.status !== "active").map((a) => ({ result: a.result, from: a.purchaseDate, to: lastDay(a), end: lastDay(a) })),
    ...orphanByDay.map((o) => ({ result: -o.amount, from: o.date, to: o.date, end: o.date })),
  ];
  const byCycle: Item[][] = Array.from({ length: closes.length + 1 }, () => []);
  for (const it of finalItems) byCycle[cycleOf(it.end)].push(it);

  let fee = 0, unallocated = 0;
  const closed = zero();
  const cycles: CycleResult[] = closes.map((c, i) => {
    const s = settle(byCycle[i]);
    fee += s.fee; unallocated += s.unallocated;
    for (const k of Object.keys(closed)) closed[k] += s.shares[k];
    return { id: c.id, closedOn: c.closedOn, from: i === 0 ? null : dayStr(dayNum(closes[i - 1].closedOn) + 1), items: byCycle[i].length, net: r2(s.net), fee: r2(s.fee), shares: s.shares };
  });
  // the open cycle: its final results alone (A), and with the animals on the farm valued today (B)
  const openFinal = byCycle[closes.length];
  const estimateItems = animals.filter((a) => a.status === "active").map((a) => ({ result: a.result, from: a.purchaseDate, to: asOf }));
  const A = settle(openFinal);
  const B = settle([...openFinal, ...estimateItems]);
  fee += B.fee; unallocated += B.unallocated;

  // ── 3. each partner ──
  const active = animals.filter((a) => a.status === "active");
  // today's percents: the money that financed the animals on the farm now
  const weightsNow = active.length ? windowWeights(active.map((a) => ({ from: a.purchaseDate, to: asOf }))) : capitalDays(partners, txns, asOf, asOf, asOf);
  const termsToday = termsOn(partners, rules, asOf);
  const pctNow = splitPercents(partners, termsToday, weightsNow);

  const positions: PartnerPosition[] = partners.map((p) => {
    const mine = txns.filter((t) => t.partnerId === p.id && t.date <= asOf);
    const sum = (type: string) => mine.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
    const capitalIn = sum("investment");
    const capitalOut = sum("withdrawal");
    const profitPaid = sum("profit");
    const advances = sum("advance");
    const loanBalance = sum("loan_in") - sum("loan_repay");
    const laborValue = laborContributions(p, asOf).reduce((s, c) => s + c.amount, 0);
    const closedShare = closed[p.id];
    const openRealized = A.shares[p.id];
    const ifSoldToday = B.shares[p.id];
    // safe to pay: the smaller of the open cycle's final result and the same with the herd valued today
    const settledProfit = closedShare + Math.min(openRealized, ifSoldToday);
    const drawn = profitPaid + advances;
    const next = rules.filter((r) => r.partnerId === p.id && r.from > asOf).sort((a, b) => a.from.localeCompare(b.from))[0];
    return {
      id: p.id, name: p.name, partnerType: p.partnerType, leftAt: p.leftAt,
      terms: termsToday[p.id], nextChange: next ? { ...next, kind: "rule" as const } : null,
      capitalIn: r2(capitalIn), capitalOut: r2(capitalOut), netCapital: r2(capitalIn - capitalOut), laborValue: r2(laborValue),
      capitalDays: Math.round(weightsNow[p.id] ?? 0),
      profitPct: r2(pctNow.profit[p.id]), lossPct: r2(pctNow.loss[p.id]),
      closedShare: r2(closedShare),
      realizedShare: r2(closedShare + openRealized),
      estimateShare: r2(ifSoldToday - openRealized),
      profitPaid: r2(profitPaid), advances: r2(advances), profitReceived: r2(drawn),
      loanBalance: r2(loanBalance),
      balance: r2(capitalIn - capitalOut + laborValue + closedShare + ifSoldToday - drawn),
      distributable: r2(Math.max(0, settledProfit - drawn)),
      withdrawable: r2(Math.max(0, capitalIn - capitalOut + laborValue + settledProfit - drawn)),
      advanceOutstanding: r2(Math.max(0, drawn - Math.max(0, settledProfit))),
      overpaid: r2(Math.max(0, profitPaid - Math.max(0, settledProfit))),
    };
  });

  const orphanRunning = orphanByDay.reduce((s, o) => s + o.amount, 0);
  const realized = finalItems.reduce((s, x) => s + x.result, 0);
  const estimate = active.reduce((s, a) => s + a.result, 0);
  return {
    farm: {
      asOf,
      capitalIn: r2(positions.reduce((s, p) => s + p.capitalIn, 0)),
      capitalOut: r2(positions.reduce((s, p) => s + p.capitalOut, 0)),
      runningCosts: r2(runningTotal),
      costPerHeadDay: r2(headDays > 0 ? (runningTotal - orphanRunning) / headDays : 0),
      herdCost: r2(active.reduce((s, a) => s + a.fullCost, 0)),
      herdValue: r2(active.reduce((s, a) => s + (a.valueToday ?? a.fullCost), 0)),
      herdValued: active.every((a) => a.valueToday != null),
      realized: r2(realized),
      openRealized: r2(A.net),
      estimate: r2(estimate),
      total: r2(realized + estimate),
      fee: r2(fee),
      feePctToday: feeOn(feeRates, asOf),
      profitPaid: r2(positions.reduce((s, p) => s + p.profitReceived, 0)),
      loansFromPartners: r2(positions.reduce((s, p) => s + p.loanBalance, 0)),
      unallocated: r2(unallocated),
      orphanRunning: r2(orphanRunning),
      cycles,
      openCycleFrom: closes.length ? dayStr(dayNum(closes[closes.length - 1].closedOn) + 1) : null,
      animals,
      marketPricePerKg: input.marketPricePerKg,
    },
    partners: positions,
  };
}

/**
 * Check a planned share rule against every day it would apply: fixed shares may not add up to
 * more than 100% on any day (other partners' later rules included).
 */
export function checkRule(partners: PositionPartner[], rules: ShareRule[], rule: ShareRule): string | null {
  if (rule.fixedPct < 0 || rule.fixedPct > 100) return "The share must be between 0% and 100%";
  const next = rules.filter((r) => r.partnerId === rule.partnerId && r.from > rule.from).map((r) => r.from).sort()[0] ?? "9999-12-31";
  const merged = [...rules.filter((r) => !(r.partnerId === rule.partnerId && r.from === rule.from)), rule];
  const days = [rule.from, ...merged.map((r) => r.from).filter((d) => d > rule.from && d < next), ...partners.map((p) => p.joinedAt).filter((d) => d > rule.from && d < next)];
  for (const d of days) {
    const terms = termsOn(partners, merged, d);
    const fixed = partners.filter((p) => terms[p.id].active && terms[p.id].shareMode === "manual").reduce((s, p) => s + terms[p.id].fixedPct, 0);
    if (fixed > 100 + 1e-9) return `On ${d} the fixed shares would add up to ${fixed.toFixed(1)}% (more than 100%)`;
  }
  return null;
}
