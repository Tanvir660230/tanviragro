"use client";

import { DEFAULT_HEALTH_PROTOCOL } from "@/lib/healthProtocol";
import { Syringe, Stethoscope, Bug, CheckCircle2 } from "lucide-react";
import type { HealthEventType } from "@/types/database";

const TYPE_CONFIG: Record<HealthEventType, { label: string; icon: React.ElementType; color: string }> = {
  vaccine:   { label: "Vaccine",   icon: Syringe,       color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  checkup:   { label: "Checkup",   icon: Stethoscope,   color: "text-green-600 bg-green-50 dark:bg-green-950/40" },
  deworming: { label: "Deworming", icon: Bug,           color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  treatment: { label: "Treatment", icon: CheckCircle2,  color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" },
  other:     { label: "Other",     icon: CheckCircle2,  color: "text-muted-foreground bg-muted" },
};

export function HealthProtocolCard() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        When a new cattle is added, the health events below are automatically scheduled on its calendar.
      </p>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-4 bottom-4 w-px bg-border" />

        <ol className="space-y-3">
          {DEFAULT_HEALTH_PROTOCOL.map((step, i) => {
            const cfg = TYPE_CONFIG[step.eventType];
            const Icon = cfg.icon;
            return (
              <li key={i} className="flex items-start gap-3 relative">
                {/* Day bubble */}
                <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold tabular-nums">
                  {step.dayOffset === 0 ? "0" : `+${step.dayOffset}`}
                </div>

                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium leading-tight">{step.title}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.notes}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Protocol: Bangladesh-specific cattle fattening schedule (FMD, HS, BQ vaccines + deworming)
      </p>
    </div>
  );
}
