/**
 * What the purchase page knows from earlier memos (pure, no I/O): last price of each item,
 * the shops bought from, each shop's last memo (to fill a new one), recent memos (to spot a
 * memo entered twice) and the items bought most often.
 *
 * Memo rows are purchase rows whose notes read "Invoice Memo. Supplier: <name>. | …" — the
 * format written by submitBulkPurchase and read by Purchase history.
 */

export type PurchaseRow = {
  id: string;
  item_id: string;
  qty: number;
  unit_cost: number | null;       // landed cost per item unit (transport included)
  recorded_at: string;            // purchase date
  created_at: string;             // when it was typed in
  notes: string | null;
};

export type LastBuy = { unitCost: number; date: string; supplier: string | null; qty: number };
export type SupplierInfo = { name: string; lastDate: string; memoCount: number; due: number };
export type MemoLine = { itemId: string; qty: number; unitCost: number };
export type RecentMemo = { key: string; date: string; enteredOn: string; supplier: string; itemCount: number; total: number };

export type PurchaseContext = {
  lastBuy: Record<string, LastBuy>;
  suppliers: SupplierInfo[];
  lastMemoBySupplier: Record<string, { date: string; lines: MemoLine[] }>;
  recentMemos: RecentMemo[];
  /** lines of every memo, by RecentMemo.key */
  memoLines: Record<string, MemoLine[]>;
  frequentItemIds: string[];
};

/** Supplier name from a memo row's notes (same rule as Purchase history), else null. */
export function memoSupplier(notes: string | null | undefined): string | null {
  const m = notes?.match(/Supplier:\s*(.*?)(?:\. | \| |\.?$|$)/);
  if (!m?.[1]) return null;
  const s = m[1].trim().replace(/\.$/, "");
  return s || null;
}

const norm = (s: string) => s.trim().toLowerCase();

export function buildPurchaseContext(input: {
  rows: PurchaseRow[];                                  // live purchase rows (undone ones removed)
  dues?: { lender: string | null; outstanding: number }[];   // open accounts payable
  recentLimit?: number;
  frequentLimit?: number;
}): PurchaseContext {
  const rows = [...input.rows].sort((a, b) =>
    a.recorded_at === b.recorded_at ? a.created_at.localeCompare(b.created_at) : a.recorded_at.localeCompare(b.recorded_at));

  const lastBuy: Record<string, LastBuy> = {};
  const count: Record<string, number> = {};
  const memos = new Map<string, RecentMemo & { lines: MemoLine[] }>();
  for (const r of rows) {
    const supplier = memoSupplier(r.notes);
    if (r.unit_cost != null && Number(r.unit_cost) > 0) {
      lastBuy[r.item_id] = { unitCost: Number(r.unit_cost), date: r.recorded_at.slice(0, 10), supplier, qty: Number(r.qty) };
    }
    count[r.item_id] = (count[r.item_id] ?? 0) + 1;
    if (!supplier) continue;
    const date = r.recorded_at.slice(0, 10);
    const key = `${date}|${norm(supplier)}`;
    const m = memos.get(key) ?? { key, date, enteredOn: r.created_at.slice(0, 10), supplier, itemCount: 0, total: 0, lines: [] };
    m.itemCount += 1;
    m.total += Number(r.qty) * Number(r.unit_cost ?? 0);
    m.lines.push({ itemId: r.item_id, qty: Number(r.qty), unitCost: Number(r.unit_cost ?? 0) });
    memos.set(key, m);
  }

  const dueBy = new Map<string, number>();
  for (const d of input.dues ?? []) if (d.lender) dueBy.set(norm(d.lender), (dueBy.get(norm(d.lender)) ?? 0) + Number(d.outstanding || 0));

  const bySupplier = new Map<string, SupplierInfo>();
  const lastMemoBySupplier: PurchaseContext["lastMemoBySupplier"] = {};
  for (const m of memos.values()) {
    const k = norm(m.supplier);
    const s = bySupplier.get(k) ?? { name: m.supplier, lastDate: m.date, memoCount: 0, due: dueBy.get(k) ?? 0 };
    s.memoCount += 1;
    if (m.date >= s.lastDate) { s.lastDate = m.date; s.name = m.supplier; }
    bySupplier.set(k, s);
    const prev = lastMemoBySupplier[k];
    if (!prev || m.date >= prev.date) lastMemoBySupplier[k] = { date: m.date, lines: m.lines };
  }
  // shops that only have a due (e.g. entered elsewhere) are still suggested
  for (const [k, due] of dueBy) if (!bySupplier.has(k)) {
    const name = (input.dues ?? []).find((d) => d.lender && norm(d.lender) === k)!.lender!;
    bySupplier.set(k, { name, lastDate: "", memoCount: 0, due });
  }

  const recentMemos = [...memos.values()]
    .sort((a, b) => (a.date === b.date ? b.enteredOn.localeCompare(a.enteredOn) : b.date.localeCompare(a.date)))
    .slice(0, input.recentLimit ?? Infinity)          // newest first; all by default (duplicate check)
    .map(({ lines: _lines, ...m }) => ({ ...m, total: Math.round(m.total * 100) / 100 }));

  const memoLines: Record<string, MemoLine[]> = {};
  for (const m of memos.values()) memoLines[m.key] = m.lines;

  return {
    memoLines,
    lastBuy,
    suppliers: [...bySupplier.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.memoCount - a.memoCount),
    lastMemoBySupplier,
    recentMemos,
    frequentItemIds: Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, input.frequentLimit ?? 8).map(([id]) => id),
  };
}

/** A memo with this shop on this date is already entered (case-insensitive shop name). */
export function findSameMemo(memos: RecentMemo[], date: string, supplier: string): RecentMemo | null {
  if (!supplier.trim()) return null;
  return memos.find((m) => m.date === date && norm(m.supplier) === norm(supplier)) ?? null;
}
