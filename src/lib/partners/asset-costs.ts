/**
 * What the farm's fixed assets cost the partners, day by day (pure, no I/O).
 * Depreciation is spread over the days it built up. A sold or scrapped asset adds, on its
 * disposal day, its value then minus the money got for it (a gain is a negative cost) — the
 * same gain or loss the accounts book (lib/accounting/engine.ts, assetDisposalGain), so the
 * partner result and the accounts' result stay one figure.
 */
import type { FixedAssetRow } from "@/lib/accounting/engine";

const DAY = 86400000;
const dayNum = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
const dayStr = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Spread an amount evenly over the days from `from` to `to` (both included). */
export function spread(out: { date: string; amount: number }[], amount: number, from: string, to: string) {
  const a = dayNum(from), b = dayNum(to);
  if (!(amount) || b < a) return;
  const per = amount / (b - a + 1);
  for (let d = a; d <= b; d++) out.push({ date: dayStr(d), amount: per });
}

export function assetDailyCosts(
  assets: Pick<FixedAssetRow, "purchaseDate" | "purchaseCost" | "accumulatedDepreciation" | "isActive" | "disposedAt" | "disposalValue">[],
  today: string,
): { date: string; amount: number }[] {
  const out: { date: string; amount: number }[] = [];
  for (const a of assets) {
    const end = a.disposedAt && a.disposedAt < today ? a.disposedAt : today;
    spread(out, a.accumulatedDepreciation, a.purchaseDate, end);   // the depreciation to date, over the days it built up
    if (!a.isActive && a.disposedAt) {
      const loss = (a.purchaseCost - a.accumulatedDepreciation) - (a.disposalValue ?? 0);
      if (Math.abs(loss) > 1e-9) out.push({ date: a.disposedAt.slice(0, 10), amount: loss });
    }
  }
  return out;
}
