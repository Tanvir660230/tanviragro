/**
 * Feed mixes by date (pure, no I/O). Each mix's ingredient rows are that day's recipe, so the
 * history of mixes IS the recipe history — with the share of each ingredient and how it
 * changed from the mix before.
 */

export type MixBatchRow = {
  id: string;
  mix_date: string;
  output_item_id: string;
  output_qty: number;
  input_qty: number;
  total_cost: number | null;
  note: string | null;
  created_at: string;
  undone_at: string | null;
  undo_reason: string | null;
};
export type MixInputRow = { item_id: string; qty: number; unit_cost: number | null; idempotency_key: string | null };
export type MixItemInfo = { name: string; unit: string; kgPerUnit: number | null };

export type MixLine = { itemId: string; name: string; unit: string; qty: number; kg: number; pct: number; cost: number | null };
export type MixEntry = {
  id: string;
  date: string;
  enteredOn: string;
  outputItemId: string;
  outputQty: number;
  cost: number | null;
  perKg: number | null;
  note: string | null;
  undone: boolean;
  undoReason: string | null;
  lines: MixLine[];
  /** share change against the previous (older, not undone) mix, in percentage points */
  change: Record<string, number>;
};

/** Batch id from a mix row key "feed-mix:<batch>:in:<item>". */
export function mixBatchIdOf(key: string | null | undefined): string | null {
  const m = key?.match(/^feed-mix:([0-9a-f-]{36}):in:/i);
  return m ? m[1] : null;
}

export const kgOf = (qty: number, it: Pick<MixItemInfo, "unit" | "kgPerUnit"> | undefined) =>
  !it ? qty : it.unit.trim().toLowerCase() === "kg" ? qty : qty * (it.kgPerUnit ?? 0);

export function buildMixHistory(batches: MixBatchRow[], inputs: MixInputRow[], items: Record<string, MixItemInfo>): MixEntry[] {
  const byBatch = new Map<string, MixInputRow[]>();
  for (const r of inputs) {
    const id = mixBatchIdOf(r.idempotency_key);
    if (!id) continue;
    (byBatch.get(id) ?? byBatch.set(id, []).get(id)!).push(r);
  }
  const oldestFirst = [...batches].sort((a, b) => a.mix_date.localeCompare(b.mix_date) || a.created_at.localeCompare(b.created_at));
  const out: MixEntry[] = [];
  let prev: MixEntry | null = null;
  for (const b of oldestFirst) {
    const rows = byBatch.get(b.id) ?? [];
    const kgTotal = rows.reduce((s, r) => s + kgOf(Number(r.qty), items[r.item_id]), 0);
    const lines: MixLine[] = rows.map((r) => {
      const it = items[r.item_id];
      const kg = kgOf(Number(r.qty), it);
      return {
        itemId: r.item_id, name: it?.name ?? "—", unit: it?.unit ?? "kg", qty: Number(r.qty), kg,
        pct: kgTotal > 0 ? (kg / kgTotal) * 100 : 0,
        cost: r.unit_cost == null ? null : Number(r.qty) * Number(r.unit_cost),
      };
    }).sort((x, y) => y.kg - x.kg);
    const undone = !!b.undone_at;
    const change: Record<string, number> = {};
    if (!undone && prev) {
      const ids = new Set([...lines.map((l) => l.itemId), ...prev.lines.map((l) => l.itemId)]);
      for (const id of ids) {
        const now = lines.find((l) => l.itemId === id)?.pct ?? 0;
        const before = prev.lines.find((l) => l.itemId === id)?.pct ?? 0;
        if (Math.abs(now - before) >= 0.5) change[id] = now - before;
      }
    }
    const cost = b.total_cost == null ? null : Number(b.total_cost);
    const entry: MixEntry = {
      id: b.id, date: b.mix_date.slice(0, 10), enteredOn: b.created_at.slice(0, 10), outputItemId: b.output_item_id,
      outputQty: Number(b.output_qty), cost, perKg: cost != null && Number(b.output_qty) > 0 ? cost / Number(b.output_qty) : null,
      note: b.note, undone, undoReason: b.undo_reason, lines, change,
    };
    out.push(entry);
    if (!undone) prev = entry;
  }
  return out.reverse();   // newest first
}
