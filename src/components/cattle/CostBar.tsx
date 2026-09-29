import { cn } from "@/lib/utils";
import type { CostParts } from "@/lib/cattle/cost-parts";

const taka = (n: number) => `${n < 0 ? "−" : ""}৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

export type CostBarLabels = { purchase: string; feed: string; farmShare: string; medical: string; other: string };

/** One animal's cost as a bar and a legend — the parts add up to the total everywhere it is shown. */
export function CostBar({ parts, labels }: { parts: CostParts; labels: CostBarLabels }) {
  const segments = [
    { label: labels.purchase, amount: parts.purchase, color: "bg-blue-500" },
    parts.farmShare != null
      ? { label: labels.farmShare, amount: parts.farmShare, color: "bg-amber-500" }
      : { label: labels.feed, amount: parts.feed ?? 0, color: "bg-amber-500" },
    { label: labels.medical, amount: parts.medical, color: "bg-red-400" },
    { label: labels.other, amount: parts.other, color: "bg-slate-400" },
  ].filter((s) => s.amount > 0);
  if (!(parts.total > 0) || segments.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
        {segments.map((s) => <div key={s.label} className={cn("h-full", s.color)} style={{ width: `${(s.amount / parts.total) * 100}%` }} title={`${s.label}: ${taka(s.amount)}`} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-1">
            <span className="flex min-w-0 items-center gap-1"><span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", s.color)} /><span className="truncate">{s.label}</span></span>
            <span className="tabular-nums">{taka(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
