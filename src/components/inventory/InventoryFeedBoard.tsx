"use client";

import { AlertTriangle, CircleStop, ClipboardCheck, Info, PlayCircle, Scale, SlidersHorizontal, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/format";
import type { Dictionary } from "@/i18n/getDictionary";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";
import { hasQty } from "@/lib/inventory/stock-view";

type TI = Dictionary["inventory_home"];
type TH = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `৳${Math.round(n).toLocaleString("en-IN")}`);
const qty = (n: number, unit: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${unit}`;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/**
 * "In use": one card per running feeding period — stock left, days left, today's rate and the
 * cost so far (an estimate until counted). The dialogs live with the page (onStart / onCount /
 * onFinish / onRule), so the same dialog opens from here, the to-do card and the stock list.
 */
export function InventoryFeedBoard({ asOf, items, open, lines, canEdit, ti, th, lang, notStartedCount, onStart, onCount, onFinish, onRule }: {
  asOf: string;
  items: FeedItemStatus[];           // feed engine status
  open: Period[];                    // usage periods currently running
  lines: LineResult[];               // running estimates of the open periods
  canEdit: boolean;
  ti: TI; th: TH;
  lang: "bn" | "en";
  /** feeds in stock that are not started (they are listed in the to-do card) */
  notStartedCount: number;
  onStart: () => void;
  onCount: (p: Period) => void;
  onFinish: (p: Period) => void;
  onRule: (p: Period) => void;
}) {
  const ruleLabel = (p: Period) =>
    p.ruleType === "chart" ? ti.rule_chart
      : p.ruleType === "pct_live_weight" ? fill(ti.rule_pct, { v: p.ruleValue ?? "" })
      : p.ruleType === "per_head" ? fill(ti.rule_head, { v: p.ruleValue ?? "" })
      : ti.rule_learn;
  const itemById = new Map<string, FeedItemStatus>(items.map((i) => [i.id, i]));
  const day = (d: string | null | undefined) => fmtDay(d, lang);

  return (
    <section id="in-use" aria-labelledby="inuse-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id="inuse-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Wheat className="h-5 w-5 text-primary" aria-hidden />{ti.in_use_title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{open.length}</span>
          </h2>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground"><Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{ti.auto_note}</p>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{ti.none_in_use}</p>
            <p className="text-sm text-muted-foreground">{notStartedCount > 0 ? ti.nothing_running : ti.none_in_use_sub}</p>
          </div>
          {canEdit && (
            <button type="button" onClick={onStart}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <PlayCircle className="h-4 w-4" aria-hidden />{ti.start_using}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {open.map((p) => {
            const pl = lines.filter((l) => l.periodId === p.id);
            // deducted so far + today's estimate, but no estimate for feed that has run out
            const running = pl.reduce((s, l) => {
              const posted = l.postedValue ?? 0;
              const out = !hasQty(itemById.get(l.itemId)?.stockQty ?? 0);
              return s + (out ? posted : l.value ?? posted);
            }, 0);
            const deductedValue = pl.reduce((s, l) => s + (l.postedValue ?? 0), 0);
            const lastPosted = pl.map((l) => l.lastPosted).filter(Boolean).sort().pop() ?? null;
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold">{p.targetName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {p.startDate > asOf ? fill(ti.starts_on, { date: day(p.startDate) }) : fill(ti.since, { date: day(p.startDate), days: daysBetween(p.startDate, asOf) + 1 })}
                      </p>
                    </div>
                    {/* the rule: tap it to change it */}
                    {canEdit ? (
                      <button type="button" onClick={() => onRule(p)} title={ti.change_rule} aria-label={`${ti.change_rule}: ${ruleLabel(p)}`}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground">
                        <Scale className="h-3 w-3" aria-hidden />{ruleLabel(p)}<SlidersHorizontal className="ml-0.5 h-3 w-3" aria-hidden />
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Scale className="h-3 w-3" aria-hidden />{ruleLabel(p)}
                      </span>
                    )}
                  </div>

                  <ul className="mt-3 space-y-3">
                    {p.lines.map((l) => {
                      const st = itemById.get(l.itemId);
                      const dl = st?.daysLeft ?? null;
                      const low = dl != null && dl <= 7;
                      const r = pl.find((x) => x.itemId === l.itemId);
                      const out = st != null && !hasQty(st.stockQty);
                      return (
                        <li key={l.itemId}>
                          <div className="flex items-baseline justify-between gap-2">
                            {p.lines.length > 1 ? <span className="truncate text-sm">{l.itemName}</span> : <span className="text-xs text-muted-foreground">{ti.stock_left}</span>}
                            <span className="shrink-0 text-lg font-bold tabular-nums leading-none">{st ? qty(st.stockQty, st.unit) : "—"}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                            {dl != null && <div className={cn("h-full rounded-full", low ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.max(4, Math.min(100, (dl / 30) * 100))}%` }} />}
                          </div>
                          <p className={cn("mt-1 flex flex-wrap justify-between gap-x-2 text-xs", low ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                            <span>{dl != null ? fill(th.days_left, { days: Math.floor(dl) }) : th.days_left_unknown}</span>
                            <span className="tabular-nums">{st?.dailyQty ? fill(ti.per_day, { qty: qty(st.dailyQty, st.unit) }) : ""}</span>
                          </p>
                          {r?.estimateBasis === "none" && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{ti.no_rate}</p>}
                          {out && <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{ti.stock_out}</p>}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border/60 pt-2.5 text-sm">
                    <span className="text-muted-foreground">
                      {ti.running_cost}{" "}
                      <span className="rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase text-amber-700 dark:text-amber-400">{th.estimate_badge}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{taka(running)}</span>
                    {deductedValue > 0 && (
                      <span className="w-full text-xs text-muted-foreground">{ti.deducted}: {taka(deductedValue)}{lastPosted ? ` · ${fill(ti.last_deducted, { date: day(lastPosted) })}` : ""}</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60 text-sm font-semibold">
                    <button type="button" onClick={() => onCount(p)}
                      className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap px-2 text-foreground hover:bg-muted/60">
                      <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />{ti.count_check}
                    </button>
                    <button type="button" onClick={() => onFinish(p)}
                      className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap px-2 text-primary hover:bg-primary/5">
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
  );
}
