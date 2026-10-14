import { cn } from "@/lib/utils";
import type { CostParts, CostPieceKey } from "@/lib/cattle/cost-parts";

const taka = (n: number) => `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

/** labour, utilities, rent, depreciation and interest are optional: without them those pieces show under "other" */
export type CostBarLabels = { purchase: string; feed: string; farmShare: string; medical: string; other: string } & Partial<Record<Exclude<CostPieceKey, "purchase" | "farmShare" | "feed" | "medical" | "other">, string>>;

const COLOR: Record<CostPieceKey, string> = {
  purchase: "bg-blue-500", farmShare: "bg-amber-500", feed: "bg-amber-500", labor: "bg-emerald-500", medical: "bg-red-400", utility: "bg-cyan-500",
  rent: "bg-violet-500", depreciation: "bg-orange-700", interest: "bg-pink-500", other: "bg-slate-400",
};

/** One animal's cost as a bar and a list by what the money went on — the parts add up to the total everywhere it is shown. */
export function CostBar({ parts, labels }: { parts: CostParts; labels: CostBarLabels }) {
  // a piece without its own label joins "other", so the list still adds up to the total
  const merged = new Map<CostPieceKey, number>();
  for (const p of parts.pieces) {
    const key: CostPieceKey = labels[p.key] ? p.key : "other";
    merged.set(key, (merged.get(key) ?? 0) + p.amount);
  }
  const segments = [...merged].filter(([, amount]) => Math.round(amount) !== 0)
    .map(([key, amount]) => ({ key, label: labels[key] as string, amount, color: COLOR[key] }));
  if (!(parts.total > 0) || segments.length === 0) return null;
  const pct = (n: number) => `${Math.round((n / parts.total) * 100)}%`;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted">
        {segments.filter((s) => s.amount > 0).map((s) => <div key={s.key} className={cn("h-full", s.color)} style={{ width: `${(s.amount / parts.total) * 100}%` }} title={`${s.label}: ${taka(s.amount)}`} />)}
      </div>
      <ul className="divide-y divide-border/60 text-xs">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 py-1">
            <span className="flex min-w-0 items-center gap-1.5"><span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-sm", s.color)} aria-hidden /><span className="truncate">{s.label}</span></span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="w-9 text-right text-[11px] text-muted-foreground">{pct(s.amount)}</span>
              <span className="w-20 text-right font-medium">{taka(s.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
