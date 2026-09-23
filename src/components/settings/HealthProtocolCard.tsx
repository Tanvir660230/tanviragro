"use client";

import { DEFAULT_HEALTH_PROTOCOL } from "@/lib/healthProtocol";
import { Syringe, Stethoscope, Bug, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import type { HealthEventType } from "@/types/database";

const TYPE_CONFIG: Record<HealthEventType, { label: string; icon: React.ElementType; color: string; badge: string }> = {
  vaccine:   { label: "Vaccination",  icon: Syringe,       color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40", badge: "border-blue-200 dark:border-blue-900" },
  checkup:   { label: "Vet Checkup",  icon: Stethoscope,   color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40", badge: "border-emerald-200 dark:border-emerald-900" },
  deworming: { label: "Deworming",    icon: Bug,           color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40", badge: "border-amber-200 dark:border-amber-900" },
  treatment: { label: "Medication",   icon: CheckCircle2,  color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40", badge: "border-purple-200 dark:border-purple-900" },
  other:     { label: "General Care", icon: Sparkles,      color: "text-muted-foreground bg-muted", badge: "border-border" },
};

export function HealthProtocolCard() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/30 border border-border/60 p-3.5 flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          When new cattle is added into the system, the 45-day fattening health protocol below is automatically scheduled into their individual timeline.
        </p>
      </div>

      <div className="relative pl-3">
        {/* Vertical line */}
        <div className="absolute left-7 top-4 bottom-4 w-0.5 bg-border/60" />

        <ol className="space-y-3">
          {DEFAULT_HEALTH_PROTOCOL.map((step, i) => {
            const cfg = TYPE_CONFIG[step.eventType] || TYPE_CONFIG.other;
            const Icon = cfg.icon;
            return (
              <li key={i} className="flex items-start gap-3 relative group">
                {/* Day bubble */}
                <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xs font-bold font-mono shadow-sm group-hover:border-primary transition-colors">
                  {step.dayOffset === 0 ? "Day 0" : `+${step.dayOffset}d`}
                </div>

                <div className="flex-1 min-w-0 rounded-xl border border-border/50 bg-card p-3 shadow-xs hover:border-primary/40 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground leading-snug">{step.title}</span>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${cfg.color} ${cfg.badge}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                  {step.notes && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.notes}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/20 px-3.5 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Standard: Bangladesh Livestock Research Institute (BLRI) Protocol</span>
        <span className="font-mono font-medium">FMD · HS · Anthrax · BQ</span>
      </div>
    </div>
  );
}
