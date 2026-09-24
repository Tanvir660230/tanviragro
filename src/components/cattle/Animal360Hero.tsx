"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, ShieldAlert, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATTLE_STATUS_STYLE } from "@/constants/status";
import type { Cattle, CattleStatus } from "@/types/database";
import { EditCattleDialog } from "@/components/cattle/EditCattleDialog";
import { CattleDetailMoreMenu } from "@/components/cattle/CattleDetailMoreMenu";
import { UndoSaleButton } from "@/components/cattle/UndoSaleButton";
import { AnimalLifecycleController } from "@/components/cattle/AnimalLifecycleController";
import { fmtBDT } from "@/lib/format";
import { useTranslation } from "@/i18n/I18nProvider";

export interface Animal360HeroProps {
  cattle: Cattle;
  currentWeight: number;
  estimatedWeightToday: number;
  weightGain: number;
  adg: number | null;
  adg14: number | null;
  adgTier: "good" | "fair" | "poor" | "none";
  adgColor: string;
  adgLabel: string;
  totalCost: number;
  breakEvenPerKg: number | null;
  marketPrice: number | null;
  daysInPen: number | null;
  latestSaleData?: { sold_at: string } | null;
  existingTagIds: string[];
  existingBreeds: string[];
  recentPhotoUrl?: string | null;
  overdueHealthCount?: number;
}

export function Animal360Hero({
  cattle: c,
  currentWeight,
  estimatedWeightToday,
  weightGain,
  adg,
  adg14,
  adgTier,
  adgColor,
  adgLabel,
  totalCost,
  breakEvenPerKg,
  marketPrice,
  daysInPen,
  latestSaleData,
  existingTagIds,
  existingBreeds,
  recentPhotoUrl,
  overdueHealthCount = 0,
}: Animal360HeroProps) {
  const { t } = useTranslation();
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const estimatedRevenue = marketPrice ? estimatedWeightToday * marketPrice : null;
  const estimatedMargin = estimatedRevenue ? estimatedRevenue - totalCost : null;
  const isProfitable = estimatedMargin !== null ? estimatedMargin >= 0 : true;

  return (
    <div className="overflow-hidden rounded-2xl bg-card border border-border shadow-card animate-fade-in-up">
      <div
        className={cn("h-1.5 w-full", {
          "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400": adgTier === "good",
          "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400": adgTier === "fair",
          "bg-gradient-to-r from-rose-400 via-rose-500 to-red-400": adgTier === "poor",
          "bg-muted/50": adgTier === "none",
        })}
      />

      {/* Header bar */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-6 py-3.5 bg-muted/20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/cattle"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background border border-border/80 text-muted-foreground transition-all hover:bg-muted hover:text-foreground shadow-2xs"
            aria-label="Back to livestock"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                ID #{c.id.slice(0, 8)}
              </span>
              <span className="text-muted-foreground/40">/</span>
              <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
                #{c.tag_id}
              </h1>

              <AnimalLifecycleController
                cattleId={c.id}
                tagId={c.tag_id}
                currentStatus={c.status as CattleStatus}
              />

              {c.is_quarantined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="h-3 w-3" />
                  Quarantined
                </span>
              )}

              {c.is_qurbani_marked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-3 w-3" />
                  Qurbani
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5 font-medium">
              <span>{c.gender === "male" ? "♂ Bull" : "♀ Cow"}</span>
              {c.breed && <span>• {c.breed}</span>}
              {daysInPen !== null && <span>• {daysInPen} days in pen</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 ml-auto">
          {c.status === "sold" &&
            latestSaleData?.sold_at &&
            nowMs - new Date(latestSaleData.sold_at).getTime() <= 7 * 86400000 && (
              <UndoSaleButton cattleId={c.id} tagId={c.tag_id} soldAt={latestSaleData.sold_at} />
            )}

          <EditCattleDialog
            cattle={{
              id: c.id,
              tag_id: c.tag_id,
              gender: c.gender,
              breed: c.breed,
              dob: c.dob,
              purchase_date: c.purchase_date ?? "",
              purchase_price: c.purchase_price ?? 0,
              initial_weight_kg: c.initial_weight_kg ?? 0,
              initial_weight_type: c.initial_weight_type,
              target_weight_kg: c.target_weight_kg ?? null,
              expected_daily_gain_kg: c.expected_daily_gain_kg ?? null,
              notes: c.notes,
              existingTagIds,
              existingBreeds,
            }}
          />

          <CattleDetailMoreMenu
            cattleId={c.id}
            tagId={c.tag_id}
            status={c.status as CattleStatus}
            isQuarantined={c.is_quarantined ?? false}
            isQurbani={c.is_qurbani_marked ?? false}
          />
        </div>
      </div>

      {/* Hero 360 Information Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Profile Avatar / Photo */}
        <div className="lg:col-span-3 flex flex-col items-center sm:items-start gap-3">
          <div className="relative w-full max-w-[200px] aspect-4/3 rounded-2xl overflow-hidden border border-border/80 bg-muted/40 shadow-xs group">
            {recentPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={recentPhotoUrl}
                alt={`Cattle #${c.tag_id}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
                <span className="text-4xl">🐂</span>
                <span className="text-xs font-medium">No photo uploaded</span>
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-xs text-[10px] font-mono font-bold border border-border/60">
              #{c.tag_id}
            </div>
          </div>
          {overdueHealthCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              <HeartPulse className="h-3.5 w-3.5 animate-pulse" />
              <span>{overdueHealthCount} Health Due</span>
            </div>
          )}
        </div>

        {/* Live Metrics Grid */}
        <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Current Weight */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Current Weight
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
              {currentWeight.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +{weightGain.toFixed(1)} kg ({(((weightGain) / (c.initial_weight_kg || 1)) * 100).toFixed(0)}%)
            </div>
          </div>

          {/* Average Daily Gain */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Daily Gain (ADG)
            </span>
            <div className={cn("text-2xl sm:text-3xl font-black font-mono", adgColor)}>
              {adg !== null ? `${adg.toFixed(2)}` : "—"}{" "}
              <span className="text-sm font-normal text-muted-foreground">kg/d</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {adg14 !== null ? `14d: ${adg14.toFixed(2)} kg/d` : adgLabel}
            </div>
          </div>

          {/* Direct Accumulated Cost */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Incurred
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
              {fmtBDT(totalCost)}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Purchase: {fmtBDT(c.purchase_price || 0)}
            </div>
          </div>

          {/* Estimated Valuation & Margin */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Est. Market Value
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-foreground">
              {estimatedRevenue ? fmtBDT(estimatedRevenue) : "—"}
            </div>
            <div
              className={cn(
                "text-xs font-bold font-mono",
                isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {estimatedMargin !== null
                ? `${estimatedMargin >= 0 ? "+" : ""}${fmtBDT(estimatedMargin)} P/L`
                : "No live price"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
