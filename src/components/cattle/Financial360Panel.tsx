"use client";

import React, { useState } from "react";
import {
  Receipt,
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cattle } from "@/types/database";
import { fmtBDT } from "@/lib/format";
import { useTranslation } from "@/i18n/I18nProvider";

interface Financial360PanelProps {
  cattle: Cattle;
  purchasePrice: number;
  totalFeedCost: number;
  directFeedCost: number;
  allocatedFeedCost: number;
  medicalCost: number;
  otherIndividualCost: number;
  totalCost: number;
  latestWeight: number;
  estimatedWeightToday: number;
  marketPrice: number | null;
  breakEvenPerKg: number | null;
}

export function Financial360Panel({
  cattle: c,
  purchasePrice,
  totalFeedCost,
  directFeedCost,
  allocatedFeedCost,
  medicalCost,
  otherIndividualCost,
  totalCost,
  latestWeight,
  estimatedWeightToday,
  marketPrice,
  breakEvenPerKg,
}: Financial360PanelProps) {
  const { t } = useTranslation();
  const estimatedRevenue = marketPrice ? estimatedWeightToday * marketPrice : null;
  const estimatedMargin = estimatedRevenue ? estimatedRevenue - totalCost : null;
  const directGainCost = latestWeight > (c.initial_weight_kg || 0)
    ? (totalCost - purchasePrice) / (latestWeight - (c.initial_weight_kg || 0))
    : null;

  return (
    <div className="space-y-6">
      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Accumulated Cost
          </span>
          <div className="text-2xl font-black font-mono text-foreground">{fmtBDT(totalCost)}</div>
          <p className="text-xs text-muted-foreground">All direct costs since purchase</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Break-Even Per KG
          </span>
          <div className="text-2xl font-black font-mono text-foreground">
            {breakEvenPerKg ? `৳${breakEvenPerKg.toFixed(1)}` : "—"}{" "}
            <span className="text-xs font-normal text-muted-foreground">/ kg</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {marketPrice ? `Current market: ৳${marketPrice}/kg` : "Market price not configured"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Cost Per KG Gained
          </span>
          <div className="text-2xl font-black font-mono text-foreground">
            {directGainCost ? `৳${directGainCost.toFixed(1)}` : "—"}{" "}
            <span className="text-xs font-normal text-muted-foreground">/ kg net gain</span>
          </div>
          <p className="text-xs text-muted-foreground">Excludes initial purchase cost</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estimated Net Margin
          </span>
          <div
            className={cn(
              "text-2xl font-black font-mono",
              estimatedMargin !== null && estimatedMargin >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {estimatedMargin !== null
              ? `${estimatedMargin >= 0 ? "+" : ""}${fmtBDT(estimatedMargin)}`
              : "—"}
          </div>
          <p className="text-xs text-muted-foreground">Based on live weight valuation</p>
        </div>
      </div>
    </div>
  );
}