"use client";

import React from "react";
import { BarChart3, Trophy, Target, Clock, Zap, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type FertilityMetrics } from "@/lib/reproduction";

interface FertilityAnalyticsTabProps {
  metrics: FertilityMetrics;
}

export function FertilityAnalyticsTab({ metrics }: FertilityAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-card border space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-emerald-500" />
            1st Service Conception
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.firstServiceConceptionRatePercent}%
          </div>
          <p className="text-[10px] text-muted-foreground">Standard target &gt; 55%</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            Services / Conception
          </span>
          <div className="text-2xl font-bold text-foreground">
            {metrics.servicesPerConception}
          </div>
          <p className="text-[10px] text-muted-foreground">Attempts per confirmed calf</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Average Days Open
          </span>
          <div className="text-2xl font-bold text-foreground">
            {metrics.averageDaysOpen} days
          </div>
          <p className="text-[10px] text-muted-foreground">Calving to fertile conception</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-purple-500" />
            Calving Interval
          </span>
          <div className="text-2xl font-bold text-foreground">
            {metrics.averageCalvingIntervalDays} days
          </div>
          <p className="text-[10px] text-muted-foreground">~12.8 months cycle</p>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Technician Performance */}
        <div className="bg-card border rounded-2xl p-4 sm:p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            AI Insemination Technician Rankings
          </h4>
          {metrics.technicianSuccessLeaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No technician records logged yet</p>
          ) : (
            <div className="space-y-2">
              {metrics.technicianSuccessLeaderboard.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-xs">
                  <div>
                    <span className="font-semibold block">{t.technicianName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.conceptions} conceived / {t.attempts} attempts
                    </span>
                  </div>
                  <Badge variant={t.successRate >= 60 ? "default" : "secondary"} className="font-bold">
                    {t.successRate}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sire Conception Performance */}
        <div className="bg-card border rounded-2xl p-4 sm:p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Bull / Semen Line Fertility Index
          </h4>
          {metrics.sireConceptionLeaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No sire conception records logged yet</p>
          ) : (
            <div className="space-y-2">
              {metrics.sireConceptionLeaderboard.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-xs">
                  <div>
                    <span className="font-semibold block">{s.sireCode}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {s.conceptions} pregnant / {s.attempts} inseminations
                    </span>
                  </div>
                  <Badge variant={s.successRate >= 60 ? "default" : "secondary"} className="font-bold">
                    {s.successRate}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
