"use client";

import React, { useState } from "react";
import {
  HeartPulse,
  Syringe,
  Pill,
  Bug,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthEvent } from "@/types/database";
import type { CattleTreatment } from "@/app/dashboard/(app)/cattle/medical-actions";
import { fmtBDT } from "@/lib/format";
import { useTranslation } from "@/i18n/I18nProvider";

interface Health360DashboardProps {
  cattleId: string;
  isQuarantined: boolean;
  events: HealthEvent[];
  treatments: CattleTreatment[];
  currentWeightKg: number;
}

export function Health360Dashboard({
  cattleId,
  isQuarantined,
  events,
  treatments,
  currentWeightKg,
}: Health360DashboardProps) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);

  const pending = events.filter((e) => !e.completed_at);
  const overdue = pending.filter((e) => e.scheduled_at < today);
  const upcoming = pending.filter((e) => e.scheduled_at >= today);
  const completed = events.filter((e) => e.completed_at);

  const totalMedicalCost = treatments.reduce(
    (acc, tr) => acc + (tr.vet_fee || 0) + (tr.additional_medical_cost || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Risk and Status Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Health Condition
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-3 w-3 rounded-full",
                isQuarantined ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
              )}
            />
            <span className="text-lg font-bold">
              {isQuarantined ? "Quarantined / Sick" : "Healthy & Stable"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isQuarantined ? "Isolated in sick pen" : "Normal housing pen"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Overdue Protocols
          </span>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {overdue.length}
          </div>
          <p className="text-xs text-muted-foreground">
            {overdue.length === 0 ? "All schedules up to date" : "Requires immediate action"}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Upcoming Vaccines
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {upcoming.length}
          </div>
          <p className="text-xs text-muted-foreground">Scheduled future events</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Vet & Med Spent
          </span>
          <div className="text-2xl font-black font-mono text-foreground">
            {fmtBDT(totalMedicalCost)}
          </div>
          <p className="text-xs text-muted-foreground">{treatments.length} treatments logged</p>
        </div>
      </div>
    </div>
  );
}