"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleStop, ClipboardCheck, PlayCircle, Scale, SlidersHorizontal, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";
import { EndDialog, RuleDialog, StartDialog, type DialogLocale, type UsageDialogData } from "@/components/inventory/FeedUsageClient";

type TI = Dictionary["inventory_home"];
type TH = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `৳${Math.round(n).toLocaleString("en-IN")}`);
const qty = (n: number, unit: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${unit}`;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function InventoryFeedBoard({ data, open, lines, canEdit, ti, th, lang }: {
  data: UsageDialogData;            // asOf, items (feed engine status), recipes
  open: Period[];                   // usage periods currently running
  lines: LineResult[];              // running estimates of the open periods
  canEdit: boolean;
  ti: TI; th: TH;
  lang: DialogLocale;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [ending, setEnding] = useState<Period | null>(null);
  const [checking, setChecking] = useState<Period | null>(null);
  const [ruleOf, setRuleOf] = useState<Period | null>(null);
  const ruleLabel = (p: Period) =>
    p.ruleType === "chart" ? ti.rule_chart
      : p.ruleType === "pct_live_weight" ? fill(ti.rule_pct, { v: p.ruleValue ?? "" })
      : p.ruleType === "per_head" ? fill(ti.rule_head, { v: p.ruleValue ?? "" })
      : ti.rule_learn;
  const itemById = new Map<string, FeedItemStatus>(data.items.map((i) => [i.id, i]));
  const notStarted = data.items.filter((i) => !i.openPeriodId && i.stockQty > 0);

  return (
    <div className="space-y-5">
      {/* in use */}
      <section aria-labelledby="inuse-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="inuse-title" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Wheat className="h-4 w-4 text-muted-foreground" aria-hidden />{ti.in_use_title} · {open.length}
          </h2>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventory/feeding-chart" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Scale className="h-3.5 w-3.5" aria-hidden />{ti.feeding_chart}</Link>
            <Link href="/dashboard/inventory/usage" className="text-xs font-medium text-primary hover:underline">{ti.usage_history}</Link>
          </div>
        </div>
        {open.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{ti.none_in_use}</p>
              <p className="text-xs text-muted-foreground">{ti.none_in_use_sub}</p>
            </div>
            {canEdit && (
              <button type="button" onClick={() => setStart("")}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                <PlayCircle className="h-4 w-4" aria-hidden />{ti.start_using}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((p) => {
              const pl = lines.filter((l) => l.periodId === p.id);
              // deducted so far + today's estimate, but no estimate for feed that has run out
              const running = pl.reduce((s, l) => {
                const posted = l.postedValue ?? 0;
                const out = (itemById.get(l.itemId)?.stockQty ?? 0) <= 0.0001;
                return s + (out ? posted : l.value ?? posted);
              }, 0);
              const deductedValue = pl.reduce((s, l) => s + (l.postedValue ?? 0), 0);
              const lastPosted = pl.map((l) => l.lastPosted).filter(Boolean).sort().pop() ?? null;
              return (
                <article key={p.id} className="flex flex-col rounded-xl border border-border bg-card shadow-card">
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{p.targetName}</h3>
                        <p className="text-xs text-muted-foreground">{p.startDate > data.asOf ? fill(ti.starts_on, { date: p.startDate }) : fill(ti.since, { date: p.startDate, days: daysBetween(p.startDate, data.asOf) + 1 })}</p>
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Scale className="h-3 w-3" aria-hidden />{ruleLabel(p)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{th.in_use}</span>
                    </div>
                    <ul className="mt-3 space-y-2.5">
                      {p.lines.map((l) => {
                        const st = itemById.get(l.itemId);
                        const dl = st?.daysLeft ?? null;
                        const low = dl != null && dl <= 7;
                        const r = pl.find((x) => x.itemId === l.itemId);
                        const out = st != null && st.stockQty <= 0.0001;
                        return (
                          <li key={l.itemId}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate">{l.itemName}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{st ? qty(st.stockQty, st.unit) : "—"}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                              {dl != null && <div className={cn("h-full rounded-full", low ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.max(4, Math.min(100, (dl / 30) * 100))}%` }} />}
                            </div>
                            <p className={cn("mt-0.5 flex flex-wrap justify-between gap-x-2 text-[11px]", low ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                              <span>{dl != null ? fill(th.days_left, { days: Math.floor(dl) }) : th.days_left_unknown}</span>
                              <span className="tabular-nums">{st?.dailyQty ? fill(ti.per_day, { qty: qty(st.dailyQty, st.unit) }) : ""}</span>
                            </p>
                            {r && (r.postedQty ?? 0) > 0 && (
                              <p className="text-[11px] text-muted-foreground">{ti.deducted}: <span className="font-medium text-foreground tabular-nums">{qty(r.postedQty ?? 0, l.unit)}</span></p>
                            )}
                            {r?.estimateBasis === "none" && <p className="text-[11px] text-amber-700 dark:text-amber-400">{ti.no_rate}</p>}
                            {out && <p className="mt-0.5 flex items-start gap-1 text-[11px] font-medium text-red-600 dark:text-red-400"><AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />{ti.stock_out}</p>}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {ti.running_cost}: <span className="font-semibold text-foreground tabular-nums">{taka(running)}</span>
                      <span className="ml-1 rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase text-amber-700 dark:text-amber-400">{th.estimate_badge}</span>
                    </p>
                    {deductedValue > 0 && (
                      <p className="text-[11px] text-muted-foreground">{ti.deducted}: {taka(deductedValue)}{lastPosted ? ` · ${fill(ti.last_deducted, { date: lastPosted })}` : ""}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{ti.auto_note}</p>
                  </div>
                  {canEdit && (
                    <div className="grid grid-cols-[auto_1fr_1fr] divide-x divide-border/60 border-t border-border/60 text-sm font-semibold">
                      <button type="button" onClick={() => setRuleOf(p)} aria-label={ti.change_rule}
                        className="flex min-h-11 items-center justify-center gap-1.5 px-3 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                        <SlidersHorizontal className="h-4 w-4" aria-hidden /><span className="sr-only sm:not-sr-only">{ti.change_rule}</span>
                      </button>
                      <button type="button" onClick={() => setChecking(p)}
                        className="flex min-h-11 items-center justify-center gap-1.5 px-2 text-foreground hover:bg-muted/60">
                        <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />{ti.count_check}
                      </button>
                      <button type="button" onClick={() => setEnding(p)}
                        className="flex min-h-11 items-center justify-center gap-1.5 px-2 text-primary hover:bg-primary/5">
                        <CircleStop className="h-4 w-4 shrink-0" aria-hidden />{ti.finished}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* in stock, not started */}
      {notStarted.length > 0 && (
        <section aria-labelledby="notstarted-title" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 id="notstarted-title" className="text-sm font-semibold">{fill(ti.not_started_title, { count: notStarted.length })}</h2>
          <p className="mb-3 text-xs text-muted-foreground">{ti.not_started_sub}</p>
          <ul className="divide-y divide-border/60">
            {notStarted.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">{qty(i.stockQty, i.unit)} · {taka(i.stockValue)}</span>
                </span>
                {canEdit && (
                  <button type="button" onClick={() => setStart(`item:${i.id}`)}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5">
                    <PlayCircle className="h-4 w-4 text-primary" aria-hidden />{ti.start_using}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && data.recipes.length > 0 && (
            <button type="button" onClick={() => setStart("")} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{ti.start_recipe}
            </button>
          )}
        </section>
      )}

      {start !== null && <StartDialog data={data} preset={start} onClose={() => setStart(null)} lang={lang} />}
      {ending && <EndDialog data={data} period={ending} onClose={() => setEnding(null)} lang={lang} />}
      {checking && <EndDialog data={data} period={checking} checkpoint onClose={() => setChecking(null)} lang={lang} />}
      {ruleOf && <RuleDialog data={data} period={ruleOf} onClose={() => setRuleOf(null)} lang={lang} />}
    </div>
  );
}
