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
    <div className="space-y-3">
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
              "block overflow-hidden rounded-xl border-l-4 border-t border-r border-b border-border shadow-card hover:shadow-md transition-shadow duration-200",
              ADG_BORDER[tier],
              unweighed
                ? "bg-gradient-to-br from-amber-50/60 to-card dark:from-amber-950/15 dark:to-card"
                : "bg-gradient-to-br from-card to-background"
            )}
          >
            {/* ── Unweighed banner ── */}
            {unweighed && (
              <div className="flex items-center justify-between gap-2 bg-amber-500/10 border-b border-amber-200/60 dark:border-amber-800/40 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    {t.cattle_details.alerts.needs_weighing}
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Tap to log →
                </span>
              </div>
            )}

            {/* ── Top: identity + actions ── */}
            <div className="flex items-start justify-between gap-2 px-3 sm:px-4 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-primary">
                    #{c.tag_id}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">
                    {c.gender === "male" ? "♂" : "♀"}
                  </span>
                  {c.breed && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {c.breed}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLE[c.status]
                    )}
                  >
                    {(t.cattle_details.dialogs as Record<string, string>)[c.status] ?? c.status}
                  </span>
                  {c.is_quarantined && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                      {t.cattle_details.status.quarantined}
                    </span>
                  )}
                  {c.is_qurbani_marked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Moon className="h-3 w-3 fill-emerald-500" /> {t.cattle_details.status.qurbani}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-0.5">
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
            <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
              {/* Weight */}
              <div className="px-3 py-2.5 text-center flex flex-col items-center justify-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Weight
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                  {displayWeight}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
                </p>
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  {weightGain !== null && weightGain > 0 ? (
                    <span className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      +{weightGain.toFixed(1)} kg
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">initial</span>
                  )}
                  {c.status === "active" && (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-[1px] rounded flex items-center gap-1 mt-0.5">
                      <Wheat className="h-2.5 w-2.5" />
                      {feedReq.totalDryMatterKg.toFixed(1)}kg
                    </span>
                  )}
                </div>
              </div>

              {/* Days */}
              <div className="px-3 py-2.5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Days
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                  {c.daysInPen !== null ? c.daysInPen : "—"}
                  {c.daysInPen !== null && <span className="text-xs font-normal text-muted-foreground ml-0.5">d</span>}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">{fmtDate(c.purchase_date)}</p>
              </div>

              {/* ADG */}
              <div className="px-3 py-2.5 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ADG
                </p>
                {c.adg !== null ? (
                  <p className={cn("mt-1 text-lg font-bold tabular-nums tracking-tight", ADG_TEXT[tier])}>
                    {c.adg.toFixed(2)}
                    <span className="text-xs font-normal opacity-70 ml-0.5">kg/d</span>
                  </p>
                ) : (
                  <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-muted-foreground">
                    —
                  </p>
                )}
                <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
                  <p className="text-xs text-muted-foreground capitalize">{adgLabel[tier]}</p>
                  {c.fcr !== null && <FCRBadge fcr={c.fcr} />}
                </div>
              </div>
            </div>

            {/* ── Target weight progress (if set) ── */}
            {c.target_weight_kg !== null && c.target_weight_kg > c.initial_weight_kg && (
              <div className="px-3 sm:px-4 pt-2.5 pb-1 border-t border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{c.initial_weight_kg}kg start</span>
                  <span className="text-xs font-semibold text-foreground">
                    {Math.min(Math.round(Math.max(((displayWeight - c.initial_weight_kg) / (c.target_weight_kg - c.initial_weight_kg)) * 100, 0)), 100)}% to {c.target_weight_kg}kg
                  </span>
                  <span className="text-xs text-muted-foreground">target {c.target_weight_kg}kg</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(Math.max(((displayWeight - c.initial_weight_kg) / (c.target_weight_kg - c.initial_weight_kg)) * 100, 0), 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Footer: investment + quick weight ── */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 sm:px-4 py-2.5 gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invested</p>
                <p className="text-sm font-bold tabular-nums">
                  {fmtBDT(c.purchase_price + c.totalFeedCost)}
                </p>
              </div>
              {c.status === "active" ? (
                <QuickWeightDialog cattleId={c.id} tagId={c.tag_id} />
              ) : (
                <div className="text-right">
                  {c.totalFeedCost > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
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
