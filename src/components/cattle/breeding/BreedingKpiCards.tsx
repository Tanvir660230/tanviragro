"use client";

import React from "react";
import { Heart, Sparkles, Calendar, Baby, Dna, Activity } from "lucide-react";

interface BreedingKpiCardsProps {
  activePregnancies: number;
  upcomingCalvings30d: number;
  activeHeatAlerts: number;
  conceptionRatePercent: number;
  totalStrawsInStock: number;
  pendingPDChecks: number;
}

export function BreedingKpiCards({
  activePregnancies,
  upcomingCalvings30d,
  activeHeatAlerts,
  conceptionRatePercent,
  totalStrawsInStock,
  pendingPDChecks,
}: BreedingKpiCardsProps) {
  const cards = [
    {
      label: "Active Pregnancies",
      value: activePregnancies,
      sub: `${upcomingCalvings30d} calvings due in 30d`,
      icon: Sparkles,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200/60 dark:border-purple-800/40",
    },
    {
      label: "Conception Rate",
      value: `${conceptionRatePercent}%`,
      sub: "First service & overall AI benchmark",
      icon: Activity,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40",
    },
    {
      label: "Active Heat Alerts",
      value: activeHeatAlerts,
      sub: "Cows in breeding window today",
      icon: Heart,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40",
    },
    {
      label: "Pending PD Checks",
      value: pendingPDChecks,
      sub: "Pregnancy diagnosis due (45d)",
      icon: Calendar,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/40",
    },
    {
      label: "Semen Straw Stock",
      value: totalStrawsInStock,
      sub: "Straws available in cryo storage",
      icon: Dna,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 hover:shadow-sm ${c.bg}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground truncate">{c.label}</span>
              <Icon className={`h-4 w-4 shrink-0 ${c.color}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{c.value}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
