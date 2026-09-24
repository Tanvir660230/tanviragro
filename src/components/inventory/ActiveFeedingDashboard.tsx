"use client";

import { useTransition } from "react";
import { Scale, Wheat, CalendarDays, AlertTriangle } from "lucide-react";
import { updateRecipeActiveUntil, updateRecipeActiveFrom } from "@/app/dashboard/(app)/inventory/recipe-actions";
import { updateRoughageActiveUntil } from "@/app/dashboard/(app)/inventory/actions";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n/I18nProvider";
import { DailyFeedDeductButton } from "./DailyFeedDeductButton";
import type { InventoryRow } from "./InventoryTable";
import { cn } from "@/lib/utils";
import { todayDhaka } from "@/lib/dates";

type LowStockFeedItem = { name: string; daysLeft: number | null };

type ActiveDietProps = {
  activeRecipeName: string | null;
  activeRecipeFrom: string | null;
  activeRecipeUntil: string | null;
  activeRoughageName: string | null;
  activeRoughageUntil: string | null;
  dailyConcentrateKg: number;
  dailyRoughageKg: number;
  feedItems: InventoryRow[];
  cattleCount: number;
  /** ESTIMATE from today's ration plan (not recorded consumption) */
  estimatedDailyCost: number;
  /** items whose cost could not be estimated (no price, or unknown kg per piece) */
  estimatedCostUnknownItems?: string[];
  lowStockFeedItems: LowStockFeedItem[];
};

function daysUntil(d: string) {
  return Math.ceil(
    (new Date(d + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
}

function DateEditor({
  currentDate,
  daysLeftLabel,
  overdueLabel,
  finishDateLabel,
  onSave,
}: {
  currentDate: string | null;
  daysLeftLabel: string;
  overdueLabel: string;
  finishDateLabel: string;
  onSave: (date: string | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value || null;
    startTransition(async () => { await onSave(val); });
  }

  const diff = currentDate ? daysUntil(currentDate) : null;

  return (
    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-lg border border-border/60">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
        <label className="text-xs font-medium shrink-0">{finishDateLabel}</label>
        <input
          type="date"
          defaultValue={currentDate ?? ""}
          onChange={handleChange}
          disabled={isPending}
          className="text-xs rounded-md border border-border bg-card px-2 py-0.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 cursor-pointer shadow-xs"
        />
      </div>
      {currentDate && diff !== null && (
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-md font-semibold border",
            diff >= 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
          )}
        >
          {diff >= 0 ? daysLeftLabel.replace("{{n}}", String(diff)) : overdueLabel}
        </span>
      )}
    </div>
  );
}

export function ActiveFeedingDashboard({
  activeRecipeName,
  activeRecipeFrom,
  activeRecipeUntil,
  activeRoughageName,
  activeRoughageUntil,
  dailyConcentrateKg,
  dailyRoughageKg,
  feedItems,
  cattleCount,
  estimatedDailyCost,
  estimatedCostUnknownItems = [],
  lowStockFeedItems,
}: ActiveDietProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const tr = t.inventory.active_feeding;

  const daysElapsed = activeRecipeFrom
    ? Math.max(0, Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date(activeRecipeFrom + "T00:00:00").getTime()) / 86400000
      ))
    : null;

  async function saveRecipeFrom(date: string | null) {
    await updateRecipeActiveFrom(date);
    router.refresh();
  }

  async function saveRecipeUntil(date: string | null) {
    await updateRecipeActiveUntil(date);
    router.refresh();
  }

  async function saveRoughageUntil(date: string | null) {
    await updateRoughageActiveUntil(date);
    router.refresh();
  }

  const hasActiveDiet = activeRecipeName || activeRoughageName;
  const perHead = cattleCount > 0 && estimatedDailyCost > 0
    ? Math.round(estimatedDailyCost / cattleCount)
    : null;

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-card">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-5 py-3.5 border-b border-border/70 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">{tr.today_heading}</h2>
          <span className="inline-flex items-center text-xs font-semibold bg-primary/10 text-primary rounded-full px-2.5 py-0.5 border border-primary/20">
            {tr.cattle_active.replace("{{n}}", String(cattleCount))}
          </span>
        </div>
        {estimatedDailyCost > 0 && (
          <div className="flex items-center gap-2 sm:text-right">
            <span className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
              {tr.est_cost_day.replace("{{amount}}", Math.round(estimatedDailyCost).toLocaleString())}
            </span>
            {perHead && (
              <span className="text-xs text-muted-foreground tabular-nums">
                ({tr.est_cost_head.replace("{{amount}}", perHead.toLocaleString())})
              </span>
            )}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Estimate (plan)
            </span>
          </div>
        )}
        {estimatedCostUnknownItems.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Not priced in this kg-based plan: {estimatedCostUnknownItems.join(", ")}. Items counted per piece are costed
            from the pieces you record (pieces × cost per piece); items without a price are costed once a price is recorded.
          </p>
        )}
      </div>

      {/* Diet panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/70">
        {/* Roughage */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shrink-0 border border-amber-200 dark:border-amber-800">
              <Wheat className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-0.5">{tr.roughage_label}</p>
              {activeRoughageName ? (
                <>
                  <p className="font-bold text-base text-foreground tracking-tight">{activeRoughageName}</p>
                  {dailyRoughageKg > 0 && (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {tr.requiring_today.replace("{{n}}", dailyRoughageKg.toFixed(1))}
                    </p>
                  )}
                  <DateEditor
                    currentDate={activeRoughageUntil}
                    daysLeftLabel={tr.days_left}
                    overdueLabel={tr.overdue}
                    finishDateLabel={tr.finish_date}
                    onSave={saveRoughageUntil}
                  />
                </>
              ) : (
                <div>
                  <p className="font-medium text-muted-foreground text-sm">{tr.none_set}</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">{tr.no_roughage_hint}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Concentrate */}
        <div className="p-5 flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0 border border-blue-200 dark:border-blue-800">
              <Scale className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-0.5">{tr.concentrate_label}</p>
              {activeRecipeName ? (
                <>
                  <p className="font-bold text-base text-foreground tracking-tight">{activeRecipeName}</p>
                  {dailyConcentrateKg > 0 && (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {tr.requiring_today.replace("{{n}}", dailyConcentrateKg.toFixed(1))}
                    </p>
                  )}

                  {/* Visual timeline — only when we have date info */}
                  {(activeRecipeFrom || activeRecipeUntil) && (() => {
                    const daysLeft = activeRecipeUntil ? Math.max(0, daysUntil(activeRecipeUntil)) : null;
                    const totalDays = (daysElapsed ?? 0) + (daysLeft ?? 0);
                    const pct = totalDays > 0 ? Math.round(((daysElapsed ?? 0) / totalDays) * 100) : 0;
                    const barColor = daysLeft === null ? "bg-blue-500"
                      : daysLeft <= 1 ? "bg-rose-500"
                      : daysLeft <= 3 ? "bg-amber-500"
                      : "bg-emerald-500";

                    return (
                      <div className="mt-3 space-y-2.5">
                        {/* Progress bar */}
                        {totalDays > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1 text-xs">
                              <span className="font-medium text-muted-foreground">
                                {daysElapsed ?? 0} দিন চলছে
                              </span>
                              {daysLeft !== null && (
                                <span className={cn("font-semibold", daysLeft <= 1 ? "text-rose-600 dark:text-rose-400" : daysLeft <= 3 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                  {daysLeft === 0 ? "আজ শেষ" : `${daysLeft} দিন বাকি`}
                                </span>
                              )}
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-300", barColor)}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Date range row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0 bg-muted/40 px-2 py-1 rounded-lg border border-border/60">
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">শুরু</span>
                            <input
                              type="date"
                              defaultValue={activeRecipeFrom ?? ""}
                              max={todayDhaka()}
                              onChange={(e) => saveRecipeFrom(e.target.value || null)}
                              className="text-xs rounded-md border border-border bg-card px-2 py-0.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
                              title="শুরুর তারিখ পরিবর্তন করলে engine সেই তারিখ থেকে recalculate করবে"
                            />
                          </div>
                          <div className="h-px flex-1 min-w-[12px] bg-border" />
                          <div className="flex items-center gap-1.5 min-w-0 bg-muted/40 px-2 py-1 rounded-lg border border-border/60">
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">শেষ</span>
                            <input
                              type="date"
                              defaultValue={activeRecipeUntil ?? ""}
                              min={activeRecipeFrom ?? undefined}
                              onChange={(e) => saveRecipeUntil(e.target.value || null)}
                              className="text-xs rounded-md border border-border bg-card px-2 py-0.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
                              placeholder="?"
                              title="শেষের তারিখ (পরিবর্তনযোগ্য)"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div>
                  <p className="font-medium text-muted-foreground text-sm">{tr.none_set}</p>
                  <p className="text-xs text-muted-foreground/80 mt-1">{tr.no_concentrate_hint}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prominent feed button */}
      {hasActiveDiet && feedItems.length > 0 && cattleCount > 0 && (
        <div className="px-5 py-4 border-t border-border bg-muted/10">
          <DailyFeedDeductButton
            feedItems={feedItems}
            cattleCount={cattleCount}
            prominent
          />
        </div>
      )}

      {/* Low-stock feed warnings */}
      {lowStockFeedItems.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-3 border-t border-amber-200 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/10">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-medium">{tr.low_stock_feed} </span>
            {lowStockFeedItems.map((i) =>
              i.daysLeft !== null ? `${i.name} (${i.daysLeft}d)` : i.name
            ).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
