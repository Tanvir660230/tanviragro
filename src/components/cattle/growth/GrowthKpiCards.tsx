"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, TrendingUp, AlertTriangle, CheckCircle2, DollarSign, Activity } from "lucide-react";
import { type GrowthHerdSummary } from "@/lib/growth/types";

interface Props {
  summary: GrowthHerdSummary;
}

export function GrowthKpiCards({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Herd Avg Weight */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Avg Live Weight</span>
            <Scale className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {summary.herdAvgWeightKg} <span className="text-xs font-normal text-muted-foreground">kg</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.totalActiveAnimals} active head
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Herd ADG */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Herd ADG</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              +{summary.herdAvgRecentAdgKg.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">kg/d</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Lifetime: +{summary.herdAvgAdgKg.toFixed(2)} kg/d
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Weigh Compliance */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">30d Weighed</span>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {summary.complianceRatePct}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.totalWeighedLast30d} of {summary.totalActiveAnimals} weighed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Herd FCR */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Avg FCR</span>
            <Activity className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {summary.herdAvgFcr.toFixed(1)}:1
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Feed DM / kg gain
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Cost / Kg Gain */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Cost / Kg Gain</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              ৳{summary.herdAvgCostPerKgGainBdt}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Feed & health variable
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Growth Anomalies / Alerts */}
      <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3.5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Growth Alerts</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {summary.totalAlertsCount}
            </div>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              {summary.criticalAlertsCount} critical action items
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
