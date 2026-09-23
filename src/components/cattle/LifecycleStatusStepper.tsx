"use client";

import { CheckCircle2, Circle, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CattleStatus } from "@/types/database";

interface Props {
  currentStatus: CattleStatus;
  isQuarantined?: boolean;
}

const LIFECYCLE_STAGES = [
  { id: "arrival", label: "Acquisition", statuses: ["active", "quarantined"] },
  { id: "growing", label: "Active Growth & Care", statuses: ["active"] },
  { id: "finishing", label: "Market Preparation", statuses: ["active"] },
  { id: "completed", label: "Sold / Discharged", statuses: ["sold", "dead", "archived"] },
];

export function LifecycleStatusStepper({ currentStatus, isQuarantined }: Props) {
  const getStageState = (stageIndex: number) => {
    if (currentStatus === "sold" || currentStatus === "dead" || currentStatus === "archived") {
      return stageIndex === 3 ? "current" : "completed";
    }
    if (isQuarantined) {
      return stageIndex === 0 ? "warning" : "upcoming";
    }
    if (currentStatus === "active") {
      if (stageIndex <= 1) return stageIndex === 1 ? "current" : "completed";
      return "upcoming";
    }
    return "upcoming";
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Lifecycle Journey & Milestone Progression
        </h4>
        <span className="text-[11px] font-medium text-muted-foreground capitalize">
          Current State: <strong className="text-foreground">{currentStatus}</strong>
          {isQuarantined && " (In Quarantine)"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {LIFECYCLE_STAGES.map((stage, idx) => {
          const state = getStageState(idx);

          return (
            <div
              key={stage.id}
              className={cn(
                "relative flex flex-col p-2.5 rounded-lg border text-left transition-all",
                state === "completed" && "bg-emerald-500/5 border-emerald-500/30 text-emerald-900 dark:text-emerald-300",
                state === "current" && "bg-primary/5 border-primary/40 text-primary shadow-xs ring-1 ring-primary/20",
                state === "warning" && "bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-300",
                state === "upcoming" && "bg-muted/40 border-border/50 text-muted-foreground opacity-70"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  Step 0{idx + 1}
                </span>
                {state === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                {state === "current" && <Circle className="h-3.5 w-3.5 fill-primary text-primary" />}
                {state === "warning" && <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                {state === "upcoming" && <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
              </div>

              <span className="text-xs font-bold line-clamp-1">{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}