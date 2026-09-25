"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, History, Loader2, Plus, Scale, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { deleteFeedChart, saveFeedChart } from "@/app/dashboard/(app)/inventory/usage/actions";
import { FEED_CHART_TEXT, type FeedChartLang } from "@/components/inventory/feed-chart-text";
import { bandFor, chartAmount, chartOn, kgFactor, weightOn, type Animal, type ChartBand, type ChartVersion } from "@/lib/feed/usage-engine";

export type ChartTarget = {
  key: string;                          // "item:<id>" | "recipe:<id>"
  type: "item" | "recipe";
  id: string;
  name: string;
  unit: string;                         // recipe: kg of mix
  kgPerUnit: number | null;
  category: string;                     // item category, "recipe" for a recipe
  inUse: boolean;
  inUseSince: string | null;           // start of the running usage period, if any
  stockQty: number | null;              // item only
  ingredients?: { itemId: string; name: string; unit: string; kgPerUnit: number | null; share: number; stockQty: number }[];
};

export type FeedChartData = {
  asOf: string;
  canEdit: boolean;
  targets: ChartTarget[];
  charts: ChartVersion[];
  animals: Animal[];
};

const T = FEED_CHART_TEXT;
type Lang = FeedChartLang;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const num = (n: number, d = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: d });

type Row = { to: string; amount: string; basis: ChartBand["basis"] };
const toRows = (bands: ChartBand[]): Row[] =>
  [...bands].sort((a, b) => a.minKg - b.minKg).map((b) => ({ to: b.maxKg == null ? "" : String(b.maxKg), amount: String(b.amount), basis: b.basis }));
/** rows → bands: each row starts where the previous one ended; the last is open-ended */
function toBands(rows: Row[]): ChartBand[] | null {
  const out: ChartBand[] = [];
  let min = 0;
  for (let i = 0; i < rows.length; i++) {
    const last = i === rows.length - 1;
    const amount = Number(rows[i].amount);
    const max = last ? null : Number(rows[i].to);
    if (rows[i].amount === "" || !Number.isFinite(amount) || amount < 0) return null;
    if (!last && (!Number.isFinite(max) || max! <= min)) return null;
    out.push({ minKg: min, maxKg: max, amount, basis: rows[i].basis });
    min = max ?? min;
  }
  return out.length ? out : null;
}

function standardRows(t: ChartTarget): Row[] | null {
  const kgOk = t.type === "recipe" || kgFactor(t.unit, t.kgPerUnit) != null;
  if (!kgOk) return null;
  if (t.type === "recipe" || t.category === "feed") {
    return [{ to: "180", amount: "1.5", basis: "pct_bw" }, { to: "300", amount: "2", basis: "pct_bw" }, { to: "", amount: "1.5", basis: "pct_bw" }];
  }
  // roughage (as fed, straw ≈ 90 % dry matter): (2.8 % DMI − concentrate DM) ÷ 0.9
  return [{ to: "180", amount: "1.6", basis: "pct_bw" }, { to: "300", amount: "1.1", basis: "pct_bw" }, { to: "", amount: "1.6", basis: "pct_bw" }];
}

export function FeedChartClient({ data, lang }: { data: FeedChartData; lang: Lang }) {
  const t = T[lang];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currentOf = (tg: ChartTarget) => chartOn(data.charts, tg.type, tg.id, data.asOf);
  const firstKey = data.targets.find((x) => x.inUse)?.key ?? data.targets[0]?.key ?? "";
  const [key, setKey] = useState(firstKey);
  const target = data.targets.find((x) => x.key === key) ?? null;

  const initialRows = (tg: ChartTarget | null): Row[] => {
    const cur = tg ? currentOf(tg) : null;
    return cur ? toRows(cur.bands) : [{ to: "", amount: "", basis: "per_head" }];
  };
  const [rows, setRows] = useState<Row[]>(() => initialRows(target));
  // a first chart applies from the day its feed started, so those days are deducted too
  const defaultFrom = (tg: ChartTarget | null) =>
    tg && tg.inUseSince && !data.charts.some((c) => c.targetType === tg.type && c.targetId === tg.id) ? tg.inUseSince : data.asOf;
  const [from, setFrom] = useState(() => defaultFrom(target));
  const [notes, setNotes] = useState("");

  const choose = (k: string) => {
    const tg = data.targets.find((x) => x.key === k) ?? null;
    setKey(k); setRows(initialRows(tg)); setFrom(defaultFrom(tg)); setNotes("");
  };

  const bands = useMemo(() => toBands(rows), [rows]);
  const unitLabel = target?.type === "recipe" ? "kg" : target?.unit ?? "";
  const pctBlocked = !!target && target.type === "item" && kgFactor(target.unit, target.kgPerUnit) == null;

  // live preview of today's need with the rows being edited
  const preview = useMemo(() => {
    if (!target || !bands) return null;
    const version: ChartVersion = { id: "draft", targetType: target.type, targetId: target.id, effectiveFrom: data.asOf, bands };
    const present = data.animals.filter((a) => a.from <= data.asOf && (a.to == null || data.asOf <= a.to));
    const rowsOut = present.map((a) => {
      const w = weightOn(a, data.asOf);
      const b = bandFor(version, w.kg);
      const c = chartAmount(version, w.kg);
      // in the target's unit: recipe = kg of mix; item per head = item unit; % of weight = kg → item unit
      let amt: number | null = c ? c.amount : null;
      if (c && c.inKg && target.type === "item") { const k = kgFactor(target.unit, target.kgPerUnit); amt = k ? c.amount / k : null; }
      return { id: a.id, tag: a.tag, kg: w.kg, basis: w.basis, band: b, amount: amt };
    }).sort((x, y) => x.tag.localeCompare(y.tag, undefined, { numeric: true }));
    const total = rowsOut.every((r) => r.amount != null) ? rowsOut.reduce((s, r) => s + (r.amount ?? 0), 0) : null;
    return { rows: rowsOut, total };
  }, [target, bands, data.animals, data.asOf]);

  const save = () => {
    if (!target) return;
    if (!bands) { toast.error(t.err_rows); return; }
    if (pctBlocked && bands.some((b) => b.basis === "pct_bw")) { toast.error(fill(t.pct_needs_kg, { unit: target.unit })); return; }
    startTransition(async () => {
      const r = await saveFeedChart({
        target: target.key, effectiveFrom: from, notes,
        bands: bands.map((b) => ({ min_kg: b.minKg, max_kg: b.maxKg, amount: b.amount, basis: b.basis })),
      });
      if (r.error) toast.error(r.error); else { toast.success(t.saved); router.refresh(); }
    });
  };
  const remove = (id: string) => {
    if (!confirm(t.confirm_delete)) return;
    startTransition(async () => {
      const r = await deleteFeedChart(id);
      if (r.error) toast.error(r.error); else { toast.success(t.deleted); router.refresh(); }
    });
  };

  const versions = target ? data.charts.filter((c) => c.targetType === target.type && c.targetId === target.id).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) : [];
  const current = target ? currentOf(target) : null;
  const std = target ? standardRows(target) : null;
  const groups: [string, ChartTarget[]][] = [
    [t.recipes, data.targets.filter((x) => x.type === "recipe")],
    [t.feeds, data.targets.filter((x) => x.type === "item")],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* targets */}
      <nav aria-label={t.title} className="min-w-0 space-y-4">
        {groups.map(([label, list]) => list.length > 0 && (
          <div key={label}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {list.map((tg) => {
                const cur = currentOf(tg);
                const on = tg.key === key;
                return (
                  <li key={tg.key} className="shrink-0 lg:shrink">
                    <button type="button" onClick={() => choose(tg.key)} aria-current={on ? "true" : undefined}
                      className={cn("w-full min-w-40 rounded-xl border px-3 py-2 text-left transition-colors",
                        on ? "border-primary/40 bg-primary/5 shadow-xs" : "border-border bg-card hover:bg-muted/50")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{tg.name}</span>
                        {tg.inUse && <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{t.in_use}</span>}
                      </span>
                      <span className={cn("mt-0.5 flex items-center gap-1 text-[11px]", cur ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
                        {cur ? <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden /> : null}
                        {cur ? fill(t.has_chart, { date: cur.effectiveFrom }) : t.no_chart}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!target ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t.pick}</p>
      ) : (
        <div className="min-w-0 space-y-5">
          {/* editor */}
          <section className="rounded-xl border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-bold"><Scale className="h-4 w-4 text-primary" aria-hidden />{target.name}</h2>
                <p className="text-xs text-muted-foreground">{current ? fill(t.current, { date: current.effectiveFrom }) : t.none_yet}</p>
              </div>
              {data.canEdit && std && (
                <Button type="button" size="sm" variant="outline" onClick={() => setRows(std)} title={t.standard_note}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />{t.standard}
                </Button>
              )}
            </header>
            <div className="space-y-2 p-4">
              <div className="hidden grid-cols-[1fr_1fr_1.2fr_1.4fr_auto] gap-2 px-1 text-[11px] font-semibold text-muted-foreground sm:grid">
                <span>{t.from}</span><span>{t.to}</span><span>{t.amount}</span><span>{t.type}</span><span className="w-8" />
              </div>
              {rows.map((r, i) => {
                const min = i === 0 ? 0 : Number(rows[i - 1].to) || 0;
                const last = i === rows.length - 1;
                return (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-[1fr_1fr_1.2fr_1.4fr_auto] sm:items-center sm:bg-transparent sm:p-0">
                    <div className="flex h-9 items-center rounded-md border border-dashed border-border px-2 text-sm tabular-nums text-muted-foreground">{num(min)} kg</div>
                    {last ? (
                      <div className="flex h-9 items-center px-2 text-sm text-muted-foreground">{t.open_end}</div>
                    ) : (
                      <Input aria-label={t.to} type="number" min={min + 0.1} step="any" value={r.to} disabled={!data.canEdit}
                        onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)))} />
                    )}
                    <Input aria-label={t.amount} type="number" min="0" step="any" value={r.amount} disabled={!data.canEdit} placeholder="0"
                      onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
                    <select aria-label={t.type} value={r.basis} disabled={!data.canEdit}
                      onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, basis: e.target.value as Row["basis"] } : x)))}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value="per_head">{fill(t.per_head, { unit: unitLabel })}</option>
                      <option value="pct_bw" disabled={pctBlocked}>{t.pct}</option>
                    </select>
                    {data.canEdit && (
                      <button type="button" aria-label={t.delete} disabled={rows.length === 1}
                        onClick={() => setRows((rs) => {
                          const next = rs.filter((_, k) => k !== i);
                          if (next.length) next[next.length - 1] = { ...next[next.length - 1], to: "" };
                          return next;
                        })}
                        className="col-span-2 flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 sm:col-span-1 sm:w-8">
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                );
              })}
              {data.canEdit && (
                <button type="button"
                  onClick={() => setRows((rs) => {
                    const prevMin = rs.length > 1 ? Number(rs[rs.length - 2].to) || 0 : 0;
                    const lastTo = String(prevMin + 100);
                    return [...rs.slice(0, -1), { ...rs[rs.length - 1], to: rs[rs.length - 1].to || lastTo }, { to: "", amount: "", basis: rs[rs.length - 1].basis }];
                  })}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <Plus className="h-3.5 w-3.5" aria-hidden />{t.add_row}
                </button>
              )}
              {std && <p className="text-[11px] text-muted-foreground">{t.standard_note}</p>}
            </div>
            {data.canEdit && (
              <footer className="space-y-3 border-t border-border px-4 py-3">
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div className="space-y-1"><Label htmlFor="fc_from">{t.starts}</Label><Input id="fc_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="fc_notes">{t.notes}</Label><Input id="fc_notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.version_note}</p>
                <div className="flex justify-end">
                  <Button type="button" onClick={save} disabled={pending || !bands}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t.save}</Button>
                </div>
              </footer>
            )}
          </section>

          {/* preview */}
          <section className="rounded-xl border border-border bg-card shadow-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">{t.preview}</h3>
              {preview?.total != null && (
                <p className="text-sm">{t.total}: <span className="font-bold tabular-nums">{num(preview.total)} {unitLabel}</span></p>
              )}
            </header>
            {!preview ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">{t.err_rows}</p>
            ) : preview.rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">{t.no_animals}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>{[t.animal, t.weight, t.band, t.per_day].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {preview.rows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-medium">{r.tag}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {r.basis === "none" ? <span className="text-amber-700 dark:text-amber-400">{t.no_weight}</span>
                              : <>{num(r.kg, 0)} kg{r.basis === "estimated" && <span className="ml-1 text-[11px] text-muted-foreground">({t.est_weight})</span>}</>}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                            {r.band ? (r.band.maxKg == null ? `${num(r.band.minKg, 0)}+ kg` : `${num(r.band.minKg, 0)}–${num(r.band.maxKg, 0)} kg`) : "—"}
                          </td>
                          <td className="px-3 py-2 font-semibold tabular-nums">{r.amount == null ? "—" : `${num(r.amount)} ${unitLabel}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.total != null && preview.total > 0 && (
                  <div className="space-y-1 border-t border-border px-4 py-3 text-xs">
                    {target.type === "item" && target.stockQty != null && (
                      <p className="text-muted-foreground">{fill(t.lasts, { days: Math.floor(target.stockQty / preview.total) })}</p>
                    )}
                    {target.type === "recipe" && target.ingredients && (
                      <>
                        <p className="font-semibold">{t.ingredients}</p>
                        <ul className="grid gap-1 sm:grid-cols-2">
                          {target.ingredients.map((g) => {
                            const k = kgFactor(g.unit, g.kgPerUnit);
                            const perDay = k ? (preview.total! * g.share) / k : null;
                            return (
                              <li key={g.itemId} className="flex justify-between gap-2 rounded-md bg-muted/40 px-2 py-1">
                                <span className="truncate">{g.name}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {perDay == null ? "—" : `${num(perDay)} ${g.unit}`}
                                  {perDay ? ` · ${fill(t.lasts, { days: Math.floor(g.stockQty / perDay) })}` : ""}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* versions */}
          {versions.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-card">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-muted-foreground" aria-hidden />{t.history}</h3>
              <ul className="divide-y divide-border/60">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold">{v.effectiveFrom}{v.id === current?.id && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] text-emerald-700 dark:text-emerald-300">✓</span>}</p>
                      <p className="text-muted-foreground">
                        {v.bands.map((b) => `${num(b.minKg, 0)}${b.maxKg == null ? "+" : `–${num(b.maxKg, 0)}`} kg: ${b.basis === "pct_bw" ? `${num(b.amount)}%` : `${num(b.amount)} ${unitLabel}`}`).join(" · ")}
                      </p>
                      {v.notes && <p className="text-muted-foreground/80">{v.notes}</p>}
                    </div>
                    {data.canEdit && (
                      <button type="button" onClick={() => remove(v.id)} disabled={pending}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />{t.delete}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

