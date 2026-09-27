/**
 * The stock page's view rules, in one place (pure: no database, no React), so the summary,
 * the to-do card, the stock list and the mix page agree on what "empty", "low" and "waiting" mean.
 */

/**
 * Below this (in the item's own unit) a balance is empty. Rounding leaves crumbs — a mix of
 * "all the stock" rounded to 2 decimals left 0.004 kg behind, which then showed as "0 kg in stock".
 */
export const STOCK_EPS = 0.01;

export const hasQty = (qty: number) => qty >= STOCK_EPS;
export const isEmptyQty = (qty: number) => Math.abs(qty) < STOCK_EPS;
/** a real minus balance (used more than was ever entered) — a ledger problem to count and fix */
export const isNegativeQty = (qty: number) => qty <= -STOCK_EPS;

export type StockGroup = "feed" | "ingredient" | "other";
export type FeedRoleLite = "mix" | "ingredient" | "direct";

export const isFeedCategory = (category: string) => category === "feed" || category === "roughage";

/** feed (a mix or fed as it is) · mix ingredient · medicine and everything else */
export function stockGroup(category: string, role: FeedRoleLite | undefined): StockGroup {
  if (!isFeedCategory(category)) return "other";
  return role === "ingredient" ? "ingredient" : "feed";
}

export type LastMix = { date: string; qty: number; mixName: string | null };

/**
 * Each ingredient's latest use in a mix, from its feed_mix_input rows (notes read
 * "Feed mix <date>[ · note] → <mix name>"). Rows may come in any order.
 */
export function lastMixByItem(rows: { item_id: string; qty: number | string; recorded_at: string; notes: string | null }[]): Record<string, LastMix> {
  const out: Record<string, LastMix> = {};
  for (const r of rows) {
    const date = String(r.recorded_at).slice(0, 10);
    const cur = out[r.item_id];
    const arrow = r.notes?.lastIndexOf(" → ") ?? -1;
    const mixName = arrow >= 0 ? r.notes!.slice(arrow + 3).trim() || null : null;
    if (!cur || date > cur.date) out[r.item_id] = { date, qty: Number(r.qty), mixName };
    else if (date === cur.date) cur.qty += Number(r.qty);     // two mixes on one day
  }
  return out;
}

export type TodoKind = "out" | "negative" | "low" | "idle" | "not_started" | "waiting";
export type TodoRow = {
  kind: TodoKind;
  /** the item (for "waiting": every ingredient waiting, in itemIds) */
  itemId: string;
  itemIds?: string[];
  name: string;
  /** days (low: days left; idle: days since bought) */
  days?: number | null;
  qty?: number;
  unit?: string;
};

type FeedLite = {
  id: string; name: string; unit: string; role: FeedRoleLite; discontinued: boolean;
  stockQty: number; openPeriodId: string | null; daysLeft: number | null; suggestedStart: string | null;
};
type ItemLite = { id: string; name: string; unit: string; category: string; stock: number; low_stock_threshold: number | null; is_discontinued?: boolean };

const TODO_ORDER: Record<TodoKind, number> = { out: 0, negative: 1, low: 2, idle: 3, not_started: 4, waiting: 5 };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * What needs doing now, most urgent first — one list instead of separate coloured boxes:
 * out of stock while in use · minus balance · running low · bought but not started (idle
 * 2+ days first) · ingredients waiting to be mixed (one row for all of them).
 */
export function buildTodo(input: { feed: FeedLite[]; items: ItemLite[]; asOf: string; lowDays?: number }): TodoRow[] {
  const lowDays = input.lowDays ?? 7;
  const rows: TodoRow[] = [];

  for (const f of input.feed) {
    if (f.openPeriodId) {
      if (!hasQty(f.stockQty)) rows.push({ kind: "out", itemId: f.id, name: f.name, qty: f.stockQty, unit: f.unit });
      else if (f.daysLeft != null && f.daysLeft <= lowDays) rows.push({ kind: "low", itemId: f.id, name: f.name, days: Math.floor(f.daysLeft), qty: f.stockQty, unit: f.unit });
      continue;
    }
    if (f.role === "ingredient" || f.discontinued || !hasQty(f.stockQty)) continue;
    const idle = f.suggestedStart ? daysBetween(f.suggestedStart, input.asOf) : null;
    rows.push({ kind: idle != null && idle >= 2 ? "idle" : "not_started", itemId: f.id, name: f.name, days: idle, qty: f.stockQty, unit: f.unit });
  }

  for (const i of input.items) {
    if (isNegativeQty(i.stock)) { rows.push({ kind: "negative", itemId: i.id, name: i.name, qty: i.stock, unit: i.unit }); continue; }
    // feed in use is judged by days left above; everything else by its alert level
    const inUse = input.feed.some((f) => f.id === i.id && f.openPeriodId);
    if (inUse) continue;
    if (i.low_stock_threshold != null && i.low_stock_threshold > 0 && hasQty(i.stock) && i.stock <= i.low_stock_threshold) {
      rows.push({ kind: "low", itemId: i.id, name: i.name, days: null, qty: i.stock, unit: i.unit });
    }
  }

  const waiting = input.feed.filter((f) => f.role === "ingredient" && !f.openPeriodId && hasQty(f.stockQty));
  if (waiting.length) {
    rows.push({ kind: "waiting", itemId: waiting[0].id, itemIds: waiting.map((w) => w.id), name: waiting.map((w) => w.name).join(", ") });
  }

  // one row per item: the most urgent reason wins
  const seen = new Set<string>();
  return rows
    .sort((a, b) => TODO_ORDER[a.kind] - TODO_ORDER[b.kind]
      // fewest days left first; longest idle first
      || (a.kind === "low" ? (a.days ?? Infinity) - (b.days ?? Infinity) : (b.days ?? 0) - (a.days ?? 0)))
    .filter((r) => (r.kind === "waiting" ? true : seen.has(r.itemId) ? false : (seen.add(r.itemId), true)));
}

/** the items the "running out" summary counts: the same rule as the to-do card */
export const lowItemIds = (todo: TodoRow[]) => todo.filter((r) => r.kind === "low" || r.kind === "out").map((r) => r.itemId);
