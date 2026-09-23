"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Activity,
  TrendingUp,
  HeartPulse,
  ArrowUpRight,
  AlertOctagon,
  BadgeCheck,
  Sparkles,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/ui/badge";
import { AiPredictionEngine } from "@/lib/ai/prediction-engine";

export interface AiAnimalInsightInput {
  id: string;
  tagNumber: string;
  breed?: string | null;
  currentWeightKg: number;
  historicalAdgKg: number;
  targetWeightKg: number | null;
  ageMonths?: number;
  vaccinationCount: number;
  overdueVaccinesCount: number;
  isQuarantined: boolean;
  /** Days with a negative/zero weight trend in the last 30 days */
  weightLossDays: number;
  /** Latest body temperature log (C) if available */
  latestTempC?: number;
}

interface Props {
  animal: AiAnimalInsightInput;
}

const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800",
  HIGH:     "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border border-orange-300 dark:border-orange-800",
  MODERATE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800",
  NORMAL:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
};

const URGENCY_STYLES: Record<string, string> = {
  IMMEDIATE: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  ACTION_REQUIRED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  MONITOR: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  OPTIONAL: "bg-muted text-muted-foreground",
  INFORMATIONAL: "bg-muted text-muted-foreground",
};

export function AiInsightPanel({ animal }: Props) {
  const { diseaseRisk, mortalityRisk, growth } = useMemo(() => {
    const diseaseRisk = AiPredictionEngine.predictDiseaseRisk({
      id: animal.id,
      tagNumber: animal.tagNumber,
      vaccinationCount: animal.vaccinationCount,
      overdueVaccinesCount: animal.overdueVaccinesCount,
      quarantineDays: animal.isQuarantined ? Math.max(1, animal.weightLossDays) : 0,
      recentWeightGainKg: animal.historicalAdgKg >= 0 ? animal.historicalAdgKg * 30 : 0,
      temperatureLogs: animal.latestTempC
        ? [{ temperature: animal.latestTempC, recordedAt: new Date().toISOString() }]
        : undefined,
    });

    const mortalityRisk = AiPredictionEngine.assessMortalityRisk({
      id: animal.id,
      tagNumber: animal.tagNumber,
      diseaseRiskScore: diseaseRisk.overallRiskScore,
      weightLossDays: animal.weightLossDays,
      daysInQuarantine: animal.isQuarantined ? Math.max(1, animal.weightLossDays) : 0,
    });

    const growth = AiPredictionEngine.predictGrowthTrajectory({
      id: animal.id,
      tagNumber: animal.tagNumber,
      currentWeightKg: animal.currentWeightKg,
      historicalAdgKg: animal.historicalAdgKg,
      targetWeightKg: animal.targetWeightKg ?? animal.currentWeightKg * 1.25,
      breed: animal.breed ?? undefined,
      ageMonths: animal.ageMonths,
    });

    return { diseaseRisk, mortalityRisk, growth };
  }, [animal]);

  const recommendations = useMemo(() => {
    const recs: { icon: React.ReactNode; text: string }[] = [];
    if (diseaseRisk.overallRiskScore > 50)
      recs.push({ icon: <HeartPulse className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />, text: "Schedule a health checkup to rule out emerging issues." });
    if (animal.overdueVaccinesCount > 0)
      recs.push({ icon: <ShieldAlert className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />, text: `${animal.overdueVaccinesCount} overdue vaccination(s) — catch up immediately.` });
    if (growth.growthPlateauRisk)
      recs.push({ icon: <TrendingUp className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />, text: "Weight plateau detected — review nutrition plan." });
    if (animal.weightLossDays > 7)
      recs.push({ icon: <AlertOctagon className="h-3 w-3 text-rose-500 shrink-0 mt-0.5" />, text: "Prolonged weight loss trend — investigate feed intake and health." });
    return recs;
  }, [diseaseRisk, growth, animal]);

  return (
    <SectionCard title="AI Insights" icon={Sparkles} iconVariant="purple" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Disease Risk */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Disease Risk</span>
            </div>
            <Badge className={cn("text-[10px] font-bold", RISK_STYLES[diseaseRisk.riskLevel] ?? RISK_STYLES.NORMAL)}>
              {diseaseRisk.riskLevel}
            </Badge>
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono">{diseaseRisk.overallRiskScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  diseaseRisk.overallRiskScore >= 50 ? "bg-rose-500" : diseaseRisk.overallRiskScore >= 30 ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${diseaseRisk.overallRiskScore}%` }}
              />
            </div>
          </div>

          <ul className="space-y-1.5">
            {diseaseRisk.earlyWarningSignals.length > 0 ? (
              diseaseRisk.earlyWarningSignals.slice(0, 2).map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug">
                  <AlertOctagon className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))
            ) : (
              <li className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" /> No critical biomarkers detected
              </li>
            )}
          </ul>

          <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
            <span className="font-semibold">Vet action:</span>{" "}
            {diseaseRisk.recommendedVetIntervention}
          </div>
        </div>

        {/* Mortality Risk */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Mortality Risk</span>
            </div>
            <Badge className={cn("text-[10px] font-bold px-2 py-1", URGENCY_STYLES[mortalityRisk.urgency])}>
              {mortalityRisk.urgency.replace(/_/g, " ")}
            </Badge>
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono">{mortalityRisk.mortalityProbabilityPct}%</span>
              <span className="text-xs text-muted-foreground">probability</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              {mortalityRisk.topRiskDrivers.slice(0, 2).join(" • ")}
            </p>
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preventative protocol</p>
            <ul className="space-y-1">
              {mortalityRisk.preventativeProtocol.slice(0, 2).map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-snug">
                  <BadgeCheck className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Growth Forecast */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Weight Forecast</span>
            </div>
            {growth.growthPlateauRisk && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Plateau risk</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 border border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">+30d</p>
              <p className="text-sm font-bold font-mono">{growth.projectedWeight30Days} kg</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">+60d</p>
              <p className="text-sm font-bold font-mono">{growth.projectedWeight60Days} kg</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">+90d</p>
              <p className="text-sm font-bold font-mono">{growth.projectedWeight90Days} kg</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Days to target</span>
              <span className="font-bold font-mono">{growth.projectedDaysToTarget} d</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Projected FCR</span>
              <span className="font-bold font-mono">{growth.expectedFeedConversionRatio}</span>
            </div>
          </div>

          {growth.growthPlateauRisk && (
            <Link
              href="/dashboard/cattle/growth"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open growth intelligence <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* AI-Generated Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommended Actions</p>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug bg-muted/30 rounded-lg px-3 py-2">
                {rec.icon}
                <span>{rec.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Model transparency footnote */}
      <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 flex items-start gap-2.5">
        <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Model:</span> {diseaseRisk.explainability.modelName} v{diseaseRisk.explainability.modelVersion}{" "}
          <span className="mx-1 text-border">•</span> Confidence{" "}
          {Math.round(diseaseRisk.explainability.confidenceScore * 100)}% —{" "}
          {diseaseRisk.explainability.primaryRationale}
        </p>
      </div>
    </SectionCard>
  );
}