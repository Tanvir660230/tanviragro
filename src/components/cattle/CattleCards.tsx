"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AlertTriangle, Wheat, Moon } from "lucide-react";
import { CATTLE_STATUS_STYLE } from "@/constants/cattle-status";
import { DeleteCattleButton } from "./DeleteCattleButton";
import { EditCattleDialog } from "./EditCattleDialog";
import { FCRBadge } from "./FCRBadge";
import { QuickWeightDialog } from "./QuickWeightDialog";
import { calculateDailyFeedRequirement } from "@/utils/feed-calculator";
import { fmtBDT } from "@/lib/format";
import type { CattleRowEnriched } from "@/app/dashboard/(app)/cattle/page";
import type { Cattle } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";

function isUnweighedRecently(lastWeighedAt: string | null): boolean {
  if (!lastWeighedAt) return true;
  return new Date(lastWeighedAt).getTime() < Date.now() - 7 * 86400000;
}

const STATUS_STYLE = CATTLE_STATUS_STYLE;

const ADG_BORDER: Record<"good" | "fair" | "poor" | "none", string> = {
  good: "border-l-emerald-500",
  fair: "border-l-amber-500",
  poor: "border-l-red-400",
  none: "border-l-border",
};

function adgTier(adg: number | null): keyof typeof ADG_BORDER {
  if (adg === null) return "none";
  if (adg >= 0.5) return "good";
  if (adg >= 0.3) return "fair";
  return "poor";
}

const ADG_TEXT: Record<keyof typeof ADG_BORDER, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-red-500 dark:text-red-400",
  none: "text-muted-foreground",
};


function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CattleCards({ cattle, allTagIds, allBreeds }: { cattle: CattleRowEnriched[]; allTagIds: string[]; allBreeds: string[] }) {
  const { t } = useTranslation();
  const sm = t.cattle_details.smart;
  const adgLabel: Record<keyof typeof ADG_BORDER, string> = {
    good: sm.performance_good,
    fair: sm.performance_fair,
    poor: sm.performance_poor,
    none: "—",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cattle.map((c) => {
        const tier = adgTier(c.adg);
        const weightGain =
          c.latestWeight !== null ? c.latestWeight - c.initial_weight_kg : null;
        const displayWeight = c.latestWeight ?? c.initial_weight_kg;

        const unweighed = c.status === "active" && isUnweighedRecently(c.lastWeighedAt);

        const feedReq = calculateDailyFeedRequirement({
          initialWeightKg: c.initial_weight_kg ?? 0,
          latestLoggedWeightKg: c.latestWeight,
          lastWeighedAt: c.lastWeighedAt,
          purchaseDate: c.purchase_date ?? new Date().toISOString(),
          expectedDailyGainKg: c.expected_daily_gain_kg ?? 0.8,
        });

        return (
          <Link
            key={c.id}
            href={`/dashboard/cattle/${c.id}`}
            style={{ willChange: "transform" }}
            className={cn(
              "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ADG_BORDER[tier],
              unweighed
                ? "bg-gradient-to-b from-amber-500/5 via-card to-card border-amber-300/60 dark:border-amber-800/40"
                : "border-border/80 hover:-translate-y-0.5"
            )}
          >
            <div>
              {/* ── Unweighed banner ── */}
              {unweighed && (
                <div className="flex items-center justify-between gap-2 bg-amber-500/10 border-b border-amber-200/60 dark:border-amber-800/40 px-3.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                      {t.cattle_details.alerts.needs_weighing}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Needs update →
                  </span>
                </div>
              )}

              {/* ── Top: identity + actions ── */}
              <div className="flex items-start justify-between gap-2 p-4 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      #{c.tag_id}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize tracking-tight",
                        STATUS_STYLE[c.status]
                      )}
                    >
                      {(t.cattle_details.dialogs as Record<string, string>)[c.status] ?? c.status}
                    </span>
                    {c.is_quarantined && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                        {t.cattle_details.status.quarantined}
                      </span>
                    )}
                    {c.is_qurbani_marked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <Moon className="h-3 w-3 fill-emerald-500 text-emerald-500" /> {t.cattle_details.status.qurbani}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">
                      {c.gender === "male" ? "♂ Male" : "♀ Female"}
                    </span>
                    {c.breed && (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground/70">
                        {c.breed}
                      </span>
                    )}
                    <span>·</span>
                    <span>{fmtDate(c.purchase_date)}</span>
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <EditCattleDialog
                    cattle={{
                      id: c.id,
                      tag_id: c.tag_id,
                      gender: c.gender,
                      breed: c.breed ?? null,
                      dob: c.dob ?? null,
                      purchase_date: c.purchase_date,
                      purchase_price: c.purchase_price,
                      initial_weight_kg: c.initial_weight_kg,
                      target_weight_kg: c.target_weight_kg ?? null,
                      expected_daily_gain_kg: c.expected_daily_gain_kg ?? null,
                      notes: c.notes ?? null,
                      existingTagIds: allTagIds.filter((t) => t !== c.tag_id),
                      existingBreeds: allBreeds,
                    }}
                  />
                  <DeleteCattleButton id={c.id} />
                </div>
              </div>

              {/* ── Stat strip: Weight | Days | ADG ── */}
              <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 bg-muted/20">
                {/* Weight */}
                <div className="p-3 text-center flex flex-col items-center justify-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Weight
                  </p>
                  <p className="mt-0.5 text-base sm:text-lg font-bold tabular-nums tracking-tight">
                    {displayWeight}
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
                  </p>
                  <div className="flex flex-col items-center gap-0.5 mt-0.5">
                    {weightGain !== null && weightGain > 0 ? (
                      <span className="text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{weightGain.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">initial</span>
                    )}
                  </div>
                </div>

                {/* Days */}
                <div className="p-3 text-center flex flex-col items-center justify-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Days
                  </p>
                  <p className="mt-0.5 text-base sm:text-lg font-bold tabular-nums tracking-tight">
                    {c.daysInPen !== null ? c.daysInPen : "—"}
                    {c.daysInPen !== null && <span className="text-xs font-normal text-muted-foreground ml-0.5">d</span>}
                  </p>
                  {c.status === "active" && (
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 mt-0.5">
                      <Wheat className="h-2.5 w-2.5" />
                      {feedReq.totalDryMatterKg.toFixed(1)}kg/d
                    </span>
                  )}
                </div>

                {/* ADG */}
                <div className="p-3 text-center flex flex-col items-center justify-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    ADG
                  </p>
                  {c.adg !== null ? (
                    <p className={cn("mt-0.5 text-base sm:text-lg font-bold tabular-nums tracking-tight", ADG_TEXT[tier])}>
                      {c.adg.toFixed(2)}
                      <span className="text-xs font-normal opacity-70 ml-0.5">kg/d</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-base sm:text-lg font-bold tabular-nums tracking-tight text-muted-foreground">
                      —
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                    <p className="text-[10px] text-muted-foreground font-medium capitalize">{adgLabel[tier]}</p>
                    {c.fcr !== null && <FCRBadge fcr={c.fcr} />}
                  </div>
                </div>
              </div>

              {/* ── Target weight progress (if set) ── */}
              {c.target_weight_kg !== null && c.target_weight_kg > c.initial_weight_kg && (
                <div className="px-4 py-2.5 border-b border-border/50">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground text-[11px]">{c.initial_weight_kg}kg start</span>
                    <span className="font-bold text-foreground text-[11px]">
                      {Math.min(Math.round(Math.max(((displayWeight - c.initial_weight_kg) / (c.target_weight_kg - c.initial_weight_kg)) * 100, 0)), 100)}% ({displayWeight}/{c.target_weight_kg}kg)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(Math.max(((displayWeight - c.initial_weight_kg) / (c.target_weight_kg - c.initial_weight_kg)) * 100, 0), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer: investment + quick weight ── */}
            <div
              className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2.5 gap-2"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("button") || target.closest("input") || target.closest("dialog")) {
                  e.stopPropagation();
                }
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Invested</p>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {fmtBDT(c.purchase_price + c.totalFeedCost)}
                </p>
              </div>
              {c.status === "active" ? (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <QuickWeightDialog cattleId={c.id} tagId={c.tag_id} />
                </div>
              ) : (
                <div className="text-right">
                  {c.totalFeedCost > 0 && (
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      +{fmtBDT(c.totalFeedCost)} feed
                    </p>
                  )}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
