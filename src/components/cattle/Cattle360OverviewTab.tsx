"use client";

import React from "react";
import { Scale, Receipt, HeartPulse, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cattle, CattleStatus } from "@/types/database";
import { fmtBDT } from "@/lib/format";
import { LifecycleStatusStepper } from "@/components/cattle/LifecycleStatusStepper";

export interface Cattle360OverviewTabProps {
  cattle: Cattle;
  currentWeight: number;
  weightGain: number;
  adg: number | null;
  totalCost: number;
  purchasePrice: number;
  allocatedFeedCost: number;
  medicalCost: number;
  otherIndividualCost: number;
  estimatedWeightToday: number;
  marketPrice: number | null;
  breakEvenPerKg: number | null;
  overdueHealthCount: number;
  onNavigateTab: (tabId: string) => void;
}

export function Cattle360OverviewTab({
  cattle: c,
  currentWeight,
  weightGain,
  adg,
  purchasePrice,
  allocatedFeedCost,
  medicalCost,
  otherIndividualCost,
  totalCost,
  estimatedWeightToday,
  marketPrice,
  breakEvenPerKg,
  overdueHealthCount,
  onNavigateTab,
}: Cattle360OverviewTabProps) {
  const estimatedRevenue = marketPrice ? estimatedWeightToday * marketPrice : null;
  const estimatedMargin = estimatedRevenue ? estimatedRevenue - totalCost : null;

  return (
    <div className="space-y-6">
      {/* Lifecycle Status Stepper */}
      <LifecycleStatusStepper
        currentStatus={c.status as CattleStatus}
        isQuarantined={c.is_quarantined ?? false}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Growth Card */}
        <div
          onClick={() => onNavigateTab("weight")}
          className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Scale className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm">Growth & Weight</h3>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Current / Start</span>
              <span className="font-mono font-bold text-sm">
                {currentWeight.toFixed(1)} kg <span className="text-muted-foreground text-xs font-normal">({c.initial_weight_kg ?? 0} kg)</span>
              </span>
            </div>
        {/* Health Card */}
        <div
          onClick={() => onNavigateTab("health")}
          className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <HeartPulse className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm">Health & Medical</h3>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Condition</span>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  c.is_quarantined
                    ? "bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                )}
              >
                {c.is_quarantined ? "Quarantined" : "Normal Pen"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Actions Due</span>
              <span
                className={cn(
                  "font-mono font-bold text-sm",
                  overdueHealthCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                )}
              >
                {overdueHealthCount} Overdue
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Medical Spent</span>
              <span className="font-mono font-bold text-sm">{fmtBDT(medicalCost)}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Vaccines & treatments</span>
            <span className="text-primary font-semibold group-hover:underline">Health hub →</span>
          </div>
        </div>

        {/* Finance Card */}
        <div
          onClick={() => onNavigateTab("finance")}
          className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs hover:border-primary/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Receipt className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm">Financial Position</h3>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Purchase Cost</span>
              <span className="font-mono font-bold text-sm">{fmtBDT(purchasePrice)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Feed & Med Expense</span>
              <span className="font-mono font-bold text-sm">
                {fmtBDT(allocatedFeedCost + medicalCost + otherIndividualCost)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Est. Direct Margin</span>
              <span
                className={cn(
                  "font-mono font-bold text-sm",
                  estimatedMargin !== null && estimatedMargin >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {estimatedMargin !== null ? `${estimatedMargin >= 0 ? "+" : ""}${fmtBDT(estimatedMargin)}` : "—"}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Break-even: {breakEvenPerKg ? `৳${breakEvenPerKg.toFixed(1)}/kg` : "—"}</span>
            <span className="text-primary font-semibold group-hover:underline">Financial 360° →</span>
          </div>
        </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Net Gain</span>
              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                +{weightGain.toFixed(1)} kg
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">ADG Performance</span>
              <span className="font-mono font-bold text-sm">
                {adg !== null ? `${adg.toFixed(2)} kg/d` : "—"}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Target: {c.target_weight_kg ? `${c.target_weight_kg} kg` : "Not set"}</span>
            <span className="text-primary font-semibold group-hover:underline">View charts →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
