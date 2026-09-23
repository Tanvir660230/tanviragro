"use client";

import { TrendingUp, Scale, DollarSign } from "lucide-react";
import { type HerdNutritionSummary } from "@/lib/nutrition/nutrition-engine";

interface AnalyticsTabProps {
  herdSummary: HerdNutritionSummary;
}

export function AnalyticsTab({ herdSummary }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Feed Conversion Ratio (FCR)</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {herdSummary.averageFcr} : 1
          </div>
          <p className="text-xs text-muted-foreground">
            Requires {herdSummary.averageFcr} kg of Feed DM to produce 1.0 kg live weight gain.
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Average Daily Intake (ADI)</span>
            <Scale className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold font-mono">
            {(herdSummary.totalDailyAsFedKg / Math.max(1, herdSummary.totalActiveCattle)).toFixed(2)} kg
          </div>
          <p className="text-xs text-muted-foreground">
            Average as-fed consumption per head per day.
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
            <span>Feed Cost Per Kg Gain</span>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold font-mono">
            ৳{(herdSummary.averageFcr * 36.5).toFixed(0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated direct feed cost to add 1 kg of live saleable beef.
          </p>
        </div>
      </div>
    </div>
  );
}
