/**
 * Who has the farm's cash (pure, no I/O).
 *
 * The cash ledger (lib/accounting/cash-ledger.ts) says how much cash the farm has; this says WHERE it
 * is — with Tanvir, with Mohiuddin, in the bank, in bKash. Each ledger row can be given to holders
 * (migration 20261014090000, keyed by the row's id): whole, or in parts (a sale paid half to each; each
 * memo's share of a supplier's running due; the opening cash). Handovers move money between holders
 * without touching the farm's cash; one waiting for the receiver to confirm counts for nobody yet.
 *
 *   holder balance  = Σ its parts of rows + confirmed handovers in − confirmed handovers out
 *   not yet said    = what no holder has been given of each row (the opening cash included)
 *   Σ holders + not yet said = cash on hand, always (no taka counted twice or dropped)
 *
 * A partner's credit for an expense they paid from their own pocket and that expense cancel (no farm cash
 * moved); the pair belongs to no holder and is never asked about.
 */
import type { CashCategory, CashRow } from "@/lib/accounting/cash-ledger";

export type HolderKind = "person" | "bank" | "mobile" | "box";

export type CashHolder = {
  id: string;
  name: string;
  kind: HolderKind;
  partnerId: string | null;
  userId: string | null;
  archived: boolean;
};

export type HandoverStatus = "pending" | "confirmed" | "rejected";
export type Handover = { id: string; date: string; fromId: string; toId: string; amount: number; note: string | null; status: HandoverStatus };

/** A holder's share of one row: `amount` taka of it, or (null) the whole row / what the parts leave. */
export type TagPart = { holderId: string; amount: number | null };

/** the opening cash, as a row that can be given like any other */
export const OPENING_KEY = "opening";

export type HolderInput = {
  rows: CashRow[];
  openingCash: number;
  holders: CashHolder[];
  /** ledger row id → its parts */
  tags: Record<string, TagPart[]>;
  handovers: Handover[];
};

/** One line of a holder's money: their part of a ledger row, or a handover in or out. */
export type HolderLine = {
  key: string;
  date: string;                // "" for the opening cash (before everything)
  description: string;
  category: CashCategory | "Opening" | "Handover";
  signed: number;              // + came to this holder, − left it (their part only)
  /** the whole row, when this line is only a part of it */
  whole?: number;
  handoverId?: string;
  counterpartId?: string;      // the other holder of a handover
};

export type HolderSummary = {
  holder: CashHolder;
  balance: number;
  moneyIn: number;             // row parts in + handovers received
  moneyOut: number;            // row parts out + handovers given
  rows: number;                // ledger rows they have a part of
  lastDate: string | null;
};

export type HolderBook = {
  holders: HolderSummary[];
  /** what nobody has been named for yet, newest first (the opening cash last) */
  unassigned: HolderLine[];
  unassignedBalance: number;
  /** handovers waiting for the receiver to confirm (not in any balance yet) */
  pending: Handover[];
  /** = opening cash + Σ ledger rows: the farm's cash, the same figure as everywhere else */
  total: number;
};

const signedOf = (r: CashRow) => (r.direction === "in" ? r.amount : -r.amount);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ledger rows that cancel and belong to no holder: a partner's own-pocket payment and its expense. */
export function passThroughIds(rows: CashRow[]): Set<string> {
  const ids = new Set(rows.map((r) => r.id));
  const out = new Set<string>();
  for (const r of rows) if (r.pairOf && ids.has(r.pairOf)) { out.add(r.id); out.add(r.pairOf); }
  return out;
}

/** The ledger as lines (opening cash first), without the pairs that cancel. */
function ledgerLines(input: HolderInput): HolderLine[] {
  const skip = passThroughIds(input.rows);
  const lines: HolderLine[] = [];
  if (Math.abs(input.openingCash) >= 0.005)
    lines.push({ key: OPENING_KEY, date: "", description: "Opening cash", category: "Opening", signed: input.openingCash });
  for (const r of input.rows)
    if (!skip.has(r.id)) lines.push({ key: r.id, date: r.date, description: r.description, category: r.category, signed: signedOf(r) });
  return lines;
}

/**
 * Share one row among its parts: fixed parts first (never more than the row), then the holder who takes
 * "the rest", and whatever is left is not yet said. Parts of unknown (removed) holders are ignored.
 */
export function splitLine(signed: number, parts: TagPart[] | undefined, known: (id: string) => boolean): { shares: [string, number][]; rest: number } {
  const sign = signed < 0 ? -1 : 1;
  let left = Math.abs(signed);
  const shares: [string, number][] = [];
  const valid = (parts ?? []).filter((p) => known(p.holderId));
  for (const p of valid) {
    if (p.amount == null || left <= 0.004) continue;
    const take = Math.min(p.amount, left);
    shares.push([p.holderId, round2(sign * take)]);
    left = round2(left - take);
  }
  const restHolder = valid.find((p) => p.amount == null);
  if (restHolder && left > 0.004) { shares.push([restHolder.holderId, round2(sign * left)]); left = 0; }
  return { shares, rest: round2(sign * left) || 0 };   // never −0
}

export function buildHolderBook(input: HolderInput): HolderBook {
  const known = new Map(input.holders.map((h) => [h.id, h]));
  const isKnown = (id: string) => known.has(id);
  const sums = new Map(input.holders.map((h) => [h.id, { balance: 0, moneyIn: 0, moneyOut: 0, rows: 0, lastDate: null as string | null }]));
  const bump = (id: string, signed: number, date: string, isRow: boolean) => {
    const s = sums.get(id)!;
    s.balance += signed;
    if (signed >= 0) s.moneyIn += signed; else s.moneyOut -= signed;
    if (isRow) s.rows += 1;
    if (date && (!s.lastDate || date > s.lastDate)) s.lastDate = date;
  };

  const unassigned: HolderLine[] = [];
  let unassignedBalance = 0;
  let total = input.openingCash;
  for (const r of input.rows) total += signedOf(r);

  for (const line of ledgerLines(input)) {
    const { shares, rest } = splitLine(line.signed, input.tags[line.key], isKnown);
    for (const [id, part] of shares) bump(id, part, line.date, true);
    if (Math.abs(rest) >= 0.005) {
      unassigned.push(shares.length ? { ...line, signed: rest, whole: line.signed } : line);
      unassignedBalance += rest;
    }
  }
  const pending: Handover[] = [];
  for (const h of input.handovers) {
    if (!isKnown(h.fromId) || !isKnown(h.toId) || h.fromId === h.toId) continue;
    if (h.status === "pending") { pending.push(h); continue; }
    if (h.status !== "confirmed") continue;
    bump(h.fromId, -h.amount, h.date, false);
    bump(h.toId, h.amount, h.date, false);
  }

  unassigned.sort((a, b) => (a.key === OPENING_KEY ? 1 : b.key === OPENING_KEY ? -1 : b.date.localeCompare(a.date)));
  const holders = input.holders
    .map((h) => ({ holder: h, ...sums.get(h.id)!, balance: round2(sums.get(h.id)!.balance) }))
    // an archived holder only shows while money is still with it
    .filter((s) => !s.holder.archived || Math.abs(s.balance) >= 0.5);
  return { holders, unassigned, unassignedBalance: round2(unassignedBalance), pending, total: round2(total) };
}

/** One holder's money, oldest first, with the running balance after each line. */
export function holderStatement(input: HolderInput, holderId: string): (HolderLine & { balance: number })[] {
  const names = new Map(input.holders.map((h) => [h.id, h.name]));
  const isKnown = (id: string) => names.has(id);
  const lines: HolderLine[] = [];
  for (const l of ledgerLines(input)) {
    const mine = splitLine(l.signed, input.tags[l.key], isKnown).shares.filter(([id]) => id === holderId).reduce((s, [, v]) => s + v, 0);
    if (Math.abs(mine) >= 0.005) lines.push(Math.abs(mine - l.signed) < 0.005 ? l : { ...l, signed: mine, whole: l.signed });
  }
  for (const h of input.handovers) {
    if (h.status !== "confirmed" || h.fromId === h.toId || !isKnown(h.fromId) || !isKnown(h.toId)) continue;
    if (h.fromId === holderId)
      lines.push({ key: `handover-${h.id}`, date: h.date, description: `→ ${names.get(h.toId)}${h.note ? ` (${h.note})` : ""}`, category: "Handover", signed: -h.amount, handoverId: h.id, counterpartId: h.toId });
    else if (h.toId === holderId)
      lines.push({ key: `handover-${h.id}`, date: h.date, description: `← ${names.get(h.fromId)}${h.note ? ` (${h.note})` : ""}`, category: "Handover", signed: h.amount, handoverId: h.id, counterpartId: h.fromId });
  }
  // by day; on one day money in before money out (as the cash ledger)
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.signed >= 0 === b.signed >= 0 ? 0 : a.signed >= 0 ? -1 : 1));
  let running = 0;
  return lines.map((l) => ({ ...l, balance: round2((running += l.signed)) }));
}

/** A holder's balance at the end of `date` (a count is compared with this). */
export function holderBalanceOn(input: HolderInput, holderId: string, date: string): number {
  return round2(holderStatement(input, holderId).filter((l) => l.date <= date).reduce((s, l) => s + l.signed, 0));
}

/** Balance at the end of each of the last `days` days up to `today` (a small trend line). */
export function balanceTrend(statement: { date: string; balance: number }[], today: string, days = 30): number[] {
  const DAY = 86400000;
  const start = Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY;
  const out: number[] = [];
  let i = 0, bal = 0;
  for (let d = 0; d < days; d++) {
    const day = new Date(start + d * DAY).toISOString().slice(0, 10);
    while (i < statement.length && statement[i].date <= day) bal = statement[i++].balance;
    out.push(bal);
  }
  return out;
}

export const HOLDER_KIND_LABEL: Record<HolderKind, { bn: string; en: string }> = {
  person: { bn: "হাতে", en: "In hand" },
  bank: { bn: "ব্যাংক", en: "Bank" },
  mobile: { bn: "মোবাইল ব্যাংকিং", en: "Mobile wallet" },
  box: { bn: "ক্যাশবাক্স", en: "Cash box" },
};

export const isHolderKind = (k: unknown): k is HolderKind => k === "person" || k === "bank" || k === "mobile" || k === "box";
