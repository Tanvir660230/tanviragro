"use client";

import {
  Wheat,
  Scale,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type HerdNutritionSummary, type NutritionAlert, type FeedNutrientProfile } from "@/lib/nutrition/nutrition-engine";

interface WorkspaceKpisProps {
  herdSummary: HerdNutritionSummary;
  inventoryItems: FeedNutrientProfile[];
  alerts: NutritionAlert[];
}

function fmtBdt(n: number) {
  if (n >= 100_000) return `৳${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(1)}K`;
  return `৳${Math.round(n)}`;
}

export function WorkspaceKpis({
  herdSummary,
  inventoryItems,
  alerts,
}: WorkspaceKpisProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Active Herd</span>
          <Wheat className="h-4 w-4 text-amber-500" />
        </div>
        <div className="text-2xl font-bold font-mono">{herdSummary.totalActiveCattle}</div>
        <p className="text-[11px] text-muted-foreground">{herdSummary.acclimatizingCount} in Acclimatization</p>
      </div>

      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Daily Feed As-Fed</span>
          <Scale className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-2xl font-bold font-mono">{herdSummary.totalDailyAsFedKg} <span className="text-xs font-normal">kg</span></div>
        <p className="text-[11px] text-muted-foreground">{herdSummary.totalDailyDmiKg} kg DM</p>
      </div>

      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Daily Feed Cost</span>
          <DollarSign className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
          {fmtBdt(herdSummary.totalEstimatedDailyCostBdt)}
        </div>
        <p className="text-[11px] text-muted-foreground">৳{herdSummary.averageCostPerHeadBdt}/head/day</p>
      </div>

      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Herd FCR</span>
          <TrendingUp className="h-4 w-4 text-violet-500" />
        </div>
        <div className="text-2xl font-bold font-mono">{herdSummary.averageFcr}</div>
        <p className="text-[11px] text-muted-foreground">Efficiency: {(herdSummary.feedEfficiencyRatio * 100).toFixed(1)}%</p>
      </div>

      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Stock Items</span>
          <Layers className="h-4 w-4 text-cyan-500" />
        </div>
        <div className="text-2xl font-bold font-mono">{inventoryItems.length}</div>
        <p className="text-[11px] text-muted-foreground">
          {inventoryItems.filter((i) => i.lowStockThresholdKg != null && i.currentStockKg <= i.lowStockThresholdKg).length} Low Stock
        </p>
      </div>

      <div className="p-3.5 rounded-xl border bg-card/60 shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase">Smart Alerts</span>
          <AlertTriangle className={cn("h-4 w-4", alerts.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
        </div>
        <div className="text-2xl font-bold font-mono">{alerts.length}</div>
        <p className="text-[11px] text-muted-foreground">
          {alerts.filter((a) => a.severity === "critical").length} Critical
        </p>
      </div>
    </div>
  );
}
