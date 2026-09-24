"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, Square, Pencil, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { startFeedUsage, endFeedUsage, cancelFeedUsage, type UsageFormState } from "@/app/dashboard/(app)/inventory/usage/actions";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";

export type UsagePageData = {
  asOf: string;
  canEdit: boolean;
  periods: Period[];
  lines: LineResult[];
  items: FeedItemStatus[];
  recipes: { id: string; name: string }[];
  totals: {
    actualThisMonth: number; estimatedThisMonth: number; actualAll: number; estimatedAll: number;
    unreconciledLines: number; recordedMissingCost: number; stockValue: number; unallocated: number;
  };
  byMonth: [string, { actual: number; estimated: number }][];
  byItem: { id: string; name: string; unit: string; actualQty: number; actualValue: number; estimatedQty: number; estimatedValue: number }[];
  cattle: { id: string; tag: string; actual: number; estimated: number; gainKg: number | null; costPerKgGain: number | null }[];
};

const taka = (n: number | null | undefined) => (n == null ? "—" : `৳${Math.round(n).toLocaleString("en-IN")}`);
const qty = (n: number | null | undefined, unit: string) => (n == null ? "—" : `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}`);

function Badge({ kind }: { kind: "actual" | "estimated" | "unreconciled" }) {
  const cls = {
    actual: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    estimated: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    unreconciled: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  }[kind];
  const label = { actual: "Actual", estimated: "Estimated · running", unreconciled: "Needs attention" }[kind];
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{label}</span>;
}

export function FeedUsageClient({ data }: { data: UsagePageData }) {
  const [start, setStart] = useState<string | null>(null);      // preselected target or "" for a free choice
  const [ending, setEnding] = useState<Period | null>(null);
  const openPeriods = data.periods.filter((p) => p.status === "open");
  const closedPeriods = data.periods.filter((p) => p.status !== "open");
  const lineOf = (periodId: string, itemId: string) => data.lines.find((l) => l.periodId === periodId && l.itemId === itemId);
  const idleWithStock = data.items.filter((i) => !i.openPeriodId && i.stockQty > 0.0001);
  const attention = data.periods.filter((p) => p.status === "unreconciled");

  return (
    <div className="space-y-5">
      {/* Summary: never one mixed number */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Feed cost this month" value={taka(data.totals.actualThisMonth)} tag="actual" sub="closed periods + recorded" />
        <Stat label="Running this month" value={taka(data.totals.estimatedThisMonth)} tag="estimated" sub="open periods, not final yet" />
        <Stat label="Feed stock value" value={taka(data.totals.stockValue)} sub="ledger, weighted average cost" />
        <Stat label="Needs attention" value={String(attention.length + (data.totals.recordedMissingCost > 0 ? 1 : 0))} tag={attention.length ? "unreconciled" : undefined} sub="gaps or missing prices" />
      </div>

      {attention.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm dark:border-rose-900/60 dark:bg-rose-950/20">
          <p className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300"><AlertTriangle className="h-4 w-4" /> Reconciliation gap</p>
          <ul className="mt-1 space-y-0.5 text-xs text-rose-800/90 dark:text-rose-300/90">
            {attention.flatMap((p) => p.lines.filter((l) => (l.gapQty ?? 0) > 0 || l.costMissing).map((l) => (
              <li key={p.id + l.itemId}>
                {l.itemName} ({p.startDate} → {p.endDate}):{" "}
                {(l.gapQty ?? 0) > 0
                  ? `you counted ${qty(l.gapQty, l.unit)} more than the recorded stock — a purchase in this period is probably not entered yet. Enter it with its real purchase date; this period then reconciles automatically.`
                  : "no priced stock-in yet, so the cost is unknown. Enter the purchase price."}
              </li>
            )))}
          </ul>
        </div>
      )}

      {/* Active periods */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Feeds in use now</h2>
            <p className="text-xs text-muted-foreground">Daily use is calculated automatically. End the period when the feed finishes.</p>
          </div>
          {data.canEdit && <Button size="sm" onClick={() => setStart("")}><Play className="mr-1 h-4 w-4" />Start using a feed</Button>}
        </header>
        {openPeriods.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No feed is in use. Start one to get automatic daily usage and cost.</p>
        ) : (
          <ul className="divide-y divide-border">
            {openPeriods.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.targetName}</span>
                  <Badge kind="estimated" />
                  <span className="text-xs text-muted-foreground">since {p.startDate} · {ruleText(p)}</span>
                  {data.canEdit && (
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEnding(p)}><Square className="mr-1 h-3.5 w-3.5" />Finished / end</Button>
                      <CancelButton periodId={p.id} />
                    </div>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {p.lines.map((l) => {
                    const r = lineOf(p.id, l.itemId);
                    const item = data.items.find((i) => i.id === l.itemId);
                    return (
                      <div key={l.itemId} className="rounded-lg bg-muted/40 p-2.5 text-xs">
                        <p className="font-medium text-sm">{l.itemName}{p.targetType === "recipe" && <span className="ml-1 text-muted-foreground">({Math.round(l.share * 100)}%)</span>}</p>
                        {r?.estimateBasis === "none" ? (
                          <p className="text-muted-foreground">Not enough data for a running estimate yet — set a feeding rule, or it is learned when this period ends.</p>
                        ) : (
                          <p>Used so far ≈ <strong>{qty(r?.qty, l.unit)}</strong> ({taka(r?.value)}) · {qty(r?.dailyQty, l.unit)}/day
                            <span className="text-muted-foreground"> — {r?.estimateBasis === "rule" ? "by feeding rule" : "learned from earlier periods"}</span></p>
                        )}
                        {item && (
                          <p className="text-muted-foreground">
                            Recorded stock {qty(item.stockQty, l.unit)}
                            {item.daysLeft != null && <> · expected to finish in ≈ <strong className="text-foreground">{Math.max(0, Math.floor(item.daysLeft))} days</strong> ({item.depletionDate})</>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {idleWithStock.length > 0 && data.canEdit && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            In stock but not in use:{" "}
            {idleWithStock.map((i, k) => (
              <span key={i.id}>
                {k > 0 && ", "}
                <button className="text-primary underline-offset-2 hover:underline" onClick={() => setStart(`item:${i.id}`)}>{i.name} ({qty(i.stockQty, i.unit)})</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Usage period history</h2>
          <p className="text-xs text-muted-foreground">Actual use = stock at the start + purchases − what was left at the end. Expected comes from the feeding rule or earlier periods.</p>
        </header>
        {closedPeriods.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No data</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>{["Feed", "Period", "Days", "Used", "Per day", "Expected", "Variance", "Cost", "Status", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedPeriods.flatMap((p) => p.lines.map((l) => {
                  const r = lineOf(p.id, l.itemId);
                  return (
                    <tr key={p.id + l.itemId}>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{l.itemName}{p.targetType === "recipe" && <span className="text-muted-foreground"> · {p.targetName}</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.startDate} → {p.endDate}</td>
                      <td className="px-3 py-2">{r?.days}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(l.consumedQty, l.unit)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(r?.dailyQty, l.unit)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{qty(r?.expectedQty, l.unit)}</td>
                      <td className={cn("px-3 py-2 whitespace-nowrap", (r?.varianceQty ?? 0) > 0 ? "text-rose-600" : "text-emerald-700")}>
                        {r?.varianceQty == null ? "—" : `${r.varianceQty > 0 ? "+" : ""}${qty(r.varianceQty, l.unit)} (${r.variancePct?.toFixed(0)}%)`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.costMissing ? "unknown" : taka(l.consumedValue)}</td>
                      <td className="px-3 py-2"><Badge kind={r?.status === "unreconciled" ? "unreconciled" : "actual"} /></td>
                      <td className="px-3 py-2">{data.canEdit && l === p.lines[0] && <button className="text-primary" title="Correct end date or count" onClick={() => setEnding(p)}><Pencil className="h-3.5 w-3.5" /></button>}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">Variance is shown, not explained: it can be wastage, a counting difference or a change in feeding — check before drawing conclusions.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Per cattle */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Feed cost per animal</h2>
            <p className="text-xs text-muted-foreground">Split by live weight, only for the days each animal was on the farm.</p>
          </header>
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Animal", "Actual", "Running (est.)", "Measured gain", "Actual cost / kg gain"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.cattle.length === 0 ? <tr><td className="px-3 py-3 text-muted-foreground" colSpan={5}>No data</td></tr> : data.cattle.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.tag}</td>
                  <td className="px-3 py-2">{taka(c.actual)}</td>
                  <td className="px-3 py-2 text-amber-700 dark:text-amber-400">{c.estimated ? taka(c.estimated) : "—"}</td>
                  <td className="px-3 py-2">{c.gainKg == null ? "needs 2 weighings" : `${c.gainKg.toFixed(1)} kg`}</td>
                  <td className="px-3 py-2">{c.costPerKgGain == null ? "—" : `৳${c.costPerKgGain.toFixed(0)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.totals.unallocated > 0.5 && <p className="px-4 py-2 text-[11px] text-muted-foreground">{taka(data.totals.unallocated)} was used on days with no animal recorded on the farm (not assigned to any animal).</p>}
        </section>

        {/* By month and by feed */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Feed cost by month and by feed</h2></header>
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Month", "Actual", "Running (est.)"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.byMonth.length === 0 ? <tr><td className="px-3 py-3 text-muted-foreground" colSpan={3}>No data</td></tr> : data.byMonth.map(([m, v]) => (
                <tr key={m}><td className="px-3 py-2">{m}</td><td className="px-3 py-2">{taka(v.actual)}</td><td className="px-3 py-2 text-amber-700 dark:text-amber-400">{v.estimated ? taka(v.estimated) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-xs border-t border-border">
            <thead className="bg-muted/40 text-muted-foreground"><tr>{["Feed", "Actual used", "Actual cost", "Running (est.)"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {data.byItem.map((i) => (
                <tr key={i.id}><td className="px-3 py-2">{i.name}</td><td className="px-3 py-2">{qty(i.actualQty, i.unit)}</td><td className="px-3 py-2">{taka(i.actualValue)}</td><td className="px-3 py-2 text-amber-700 dark:text-amber-400">{i.estimatedValue ? taka(i.estimatedValue) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {start !== null && <StartDialog data={data} preset={start} onClose={() => setStart(null)} />}
      {ending && <EndDialog data={data} period={ending} onClose={() => setEnding(null)} />}
    </div>
  );
}

function ruleText(p: Period): string {
  if (p.ruleType === "pct_live_weight") return `${p.ruleValue}% of live weight per day`;
  if (p.ruleType === "per_head") return `${p.ruleValue} per head per day`;
  return "split by live weight";
}

function Stat({ label, value, sub, tag }: { label: string; value: string; sub: string; tag?: "actual" | "estimated" | "unreconciled" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p>{tag && <Badge kind={tag} />}</div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function CancelButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={pending} onClick={() => {
      const reason = prompt("Why cancel this period? (kept in the history)");
      if (!reason) return;
      start(async () => {
        const r = await cancelFeedUsage(periodId, reason);
        if (r.error) toast.error(r.error); else { toast.success("Period cancelled"); router.refresh(); }
      });
    }}>Cancel</Button>
  );
}

function RuleFields({ prefix = "" }: { prefix?: string }) {
  const [type, setType] = useState("weight_share");
  return (
    <div className="space-y-1.5">
      <Label>How is it fed? (for the daily estimate)</Label>
      <select name={`${prefix}rule_type`} value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
        <option value="weight_share">I don&apos;t know exactly — learn it from what gets used</option>
        <option value="pct_live_weight">A % of each animal&apos;s live weight per day</option>
        <option value="per_head">A fixed amount per animal per day</option>
      </select>
      {type !== "weight_share" && (
        <Input name={`${prefix}rule_value`} type="number" min="0.001" step="0.001" required
          placeholder={type === "pct_live_weight" ? "e.g. 1.5 (%)" : "e.g. 2 (pieces or kg per animal)"} />
      )}
      <p className="text-[11px] text-muted-foreground">Only used for the running estimate and the forecast. The actual use always comes from the stock left when you end the period.</p>
    </div>
  );
}

function TargetSelect({ data, name, defaultValue, allowEmpty }: { data: UsagePageData; name: string; defaultValue?: string; allowEmpty?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={!allowEmpty} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
      <option value="">{allowEmpty ? "— nothing new —" : "Choose…"}</option>
      <optgroup label="Feeds">
        {data.items.filter((i) => !i.openPeriodId).map((i) => <option key={i.id} value={`item:${i.id}`}>{i.name} ({i.unit})</option>)}
      </optgroup>
      {data.recipes.length > 0 && (
        <optgroup label="Recipes (ingredients fed together)">
          {data.recipes.map((r) => <option key={r.id} value={`recipe:${r.id}`}>{r.name}</option>)}
        </optgroup>
      )}
    </select>
  );
}

function StartDialog({ data, preset, onClose }: { data: UsagePageData; preset: string; onClose: () => void }) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<UsageFormState, FormData>(startFeedUsage, undefined);
  useEffect(() => { if (state?.success) { toast.success("Feed started — daily use is now calculated automatically"); onClose(); router.refresh(); } }, [state?.success, onClose, router]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Start using a feed</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="key" value={key} />
          <div className="space-y-1.5"><Label>Feed or recipe *</Label><TargetSelect data={data} name="target" defaultValue={preset} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="us_start">Started feeding on *</Label>
            <Input id="us_start" name="start_date" type="date" max={data.asOf} defaultValue={data.asOf} required />
            <p className="text-[11px] text-muted-foreground">Past dates are fine — enter it whenever it suits you.</p>
          </div>
          <RuleFields />
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({ data, period, onClose }: { data: UsagePageData; period: Period; onClose: () => void }) {
  const router = useRouter();
  const correcting = period.status !== "open";
  const [state, action, pending] = useActionState<UsageFormState, FormData>(endFeedUsage, undefined);
  useEffect(() => {
    if (state?.success) {
      toast.success(state.status === "unreconciled" ? "Saved — but the count is higher than recorded stock (see ‘Needs attention’)" : "Period ended — actual use and cost calculated");
      onClose(); router.refresh();
    }
  }, [state?.success, state?.status, onClose, router]);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{correcting ? "Correct" : "End"} · {period.targetName}</DialogTitle></DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="period_id" value={period.id} />
          <div className="space-y-1.5">
            <Label htmlFor="ue_end">Last day it was fed *</Label>
            <Input id="ue_end" name="end_date" type="date" min={period.startDate} max={data.asOf} defaultValue={period.endDate ?? data.asOf} required />
          </div>
          <div className="space-y-2">
            <Label>What is left now? (0 if finished)</Label>
            {period.lines.map((l) => (
              <div key={l.itemId} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{l.itemName}</span>
                <Input name={`closing:${l.itemId}`} type="number" min="0" step="0.01" required className="w-28 text-right" defaultValue={l.closingQty ?? 0} />
                <span className="w-12 text-xs text-muted-foreground">{l.unit}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Used = stock at the start + purchases in between − what is left. Purchases entered later with their real date are included automatically.</p>
          </div>
          {correcting ? (
            <div className="space-y-1.5"><Label htmlFor="ue_reason">Reason for the correction *</Label><Input id="ue_reason" name="reason" required placeholder="e.g. recounted the store" /></div>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-border p-2.5">
              <Label>Start the next feed right away? (optional)</Label>
              <TargetSelect data={data} name="next_target" allowEmpty />
              <Input name="next_start_date" type="date" max={data.asOf} defaultValue={data.asOf} />
              <p className="text-[11px] text-muted-foreground">The next feed starts on this date with the rule “learn from what gets used”; you can change it later.</p>
            </div>
          )}
          {state?.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{correcting ? "Save correction" : "End period"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
