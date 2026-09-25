"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleStop, PlayCircle, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/i18n/getDictionary";
import type { LineResult, Period } from "@/lib/feed/usage-engine";
import type { FeedItemStatus } from "@/lib/feed/feed-data";
import { EndDialog, StartDialog, type UsageDialogData } from "@/components/inventory/FeedUsageClient";

type TI = Dictionary["inventory_home"];
type TH = Dictionary["home"];

const taka = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `৳${Math.round(n).toLocaleString("en-IN")}`);
const qty = (n: number, unit: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ${unit}`;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function InventoryFeedBoard({ data, open, lines, canEdit, ti, th }: {
  data: UsageDialogData;            // asOf, items (feed engine status), recipes
  open: Period[];                   // usage periods currently running
  lines: LineResult[];              // running estimates of the open periods
  canEdit: boolean;
  ti: TI; th: TH;
}) {
  const [start, setStart] = useState<string | null>(null);
  const [ending, setEnding] = useState<Period | null>(null);
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
          <Link href="/dashboard/inventory/usage" className="text-xs font-medium text-primary hover:underline">{ti.usage_history}</Link>
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
              const running = lines.filter((l) => l.periodId === p.id).reduce((s, l) => s + (l.value ?? 0), 0);
              return (
                <article key={p.id} className="flex flex-col rounded-xl border border-border bg-card shadow-card">
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold">{p.targetName}</h3>
                        <p className="text-xs text-muted-foreground">{fill(ti.since, { date: p.startDate, days: daysBetween(p.startDate, data.asOf) + 1 })}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{th.in_use}</span>
                    </div>
                    <ul className="mt-3 space-y-2.5">
                      {p.lines.map((l) => {
                        const st = itemById.get(l.itemId);
                        const dl = st?.daysLeft ?? null;
                        const low = dl != null && dl <= 7;
                        return (
                          <li key={l.itemId}>
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="truncate">{l.itemName}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">{st ? qty(st.stockQty, st.unit) : "—"}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                              {dl != null && <div className={cn("h-full rounded-full", low ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.max(4, Math.min(100, (dl / 30) * 100))}%` }} />}
                            </div>
                            <p className={cn("mt-0.5 text-[11px]", low ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                              {dl != null ? fill(th.days_left, { days: dl }) : th.days_left_unknown}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {ti.running_cost}: <span className="font-semibold text-foreground tabular-nums">{taka(running)}</span>
                      <span className="ml-1 rounded-full border border-dashed border-amber-500/50 px-1.5 py-px text-[10px] font-medium uppercase text-amber-700 dark:text-amber-400">{th.estimate_badge}</span>
                    </p>
                  </div>
                  {canEdit && (
                    <button type="button" onClick={() => setEnding(p)}
                      className="flex min-h-11 items-center justify-center gap-2 border-t border-border/60 text-sm font-semibold text-primary hover:bg-primary/5">
                      <CircleStop className="h-4 w-4" aria-hidden />{ti.finished}
                    </button>
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

      {start !== null && <StartDialog data={data} preset={start} onClose={() => setStart(null)} />}
      {ending && <EndDialog data={data} period={ending} onClose={() => setEnding(null)} />}
    </div>
  );
}
