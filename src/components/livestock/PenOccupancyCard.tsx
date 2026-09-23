"use client";

import React from "react";
import { PenEntity, PenEngine } from "@/lib/livestock/pen-engine";
import { cn } from "@/lib/utils";
import { Users, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

interface Props {
  pen: PenEntity;
  onMoveClick?: (pen: PenEntity) => void;
  onEditClick?: (pen: PenEntity) => void;
}

export function PenOccupancyCard({ pen, onMoveClick, onEditClick }: Props) {
  const metrics = PenEngine.calculatePenOccupancy(pen.capacity, pen.currentOccupancy, pen.id);

  const TYPE_BADGES: Record<PenEntity["type"], { label: string; className: string }> = {
    fattening: { label: "Fattening", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900" },
    quarantine: { label: "Quarantine", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900" },
    isolation: { label: "Isolation", className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900" },
    nursery: { label: "Nursery", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900" },
    maternity: { label: "Maternity", className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900" },
    general: { label: "General", className: "bg-muted text-muted-foreground border-border" },
  };

  const badge = TYPE_BADGES[pen.type] || TYPE_BADGES.general;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-card/60 hover:bg-card hover:shadow-md",
        metrics.isOverCapacity
          ? "border-rose-300 dark:border-rose-900/60 bg-rose-500/[0.02]"
          : metrics.isNearCapacity
          ? "border-amber-300 dark:border-amber-900/60 bg-amber-500/[0.02]"
          : "border-border/70"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-muted-foreground">{pen.code}</span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
          <h3 className="text-base font-bold text-foreground mt-0.5">{pen.name}</h3>
        </div>

        {metrics.isOverCapacity ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 border border-rose-200 dark:border-rose-900">
            <ShieldAlert className="h-3 w-3" /> Over {metrics.occupancyRatePct}%
          </span>
        ) : metrics.isNearCapacity ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 border border-amber-200 dark:border-amber-900">
            <AlertTriangle className="h-3 w-3" /> Warning {metrics.occupancyRatePct}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="h-3 w-3" /> Available
          </span>
        )}
      </div>

      {/* Capacity progress bar */}
      <div className="space-y-1.5 mt-4">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Occupancy
          </span>
          <span className="font-mono font-bold text-foreground">
            {pen.currentOccupancy} / {pen.capacity} head ({metrics.occupancyRatePct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              metrics.isOverCapacity
                ? "bg-rose-500"
                : metrics.isNearCapacity
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(100, metrics.occupancyRatePct)}%` }}
          />
        </div>
      </div>

      {/* Quick Action Footer */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-mono text-[11px]">
          {metrics.availableCapacity} slots remaining
        </span>
        {onMoveClick && (
          <button
            onClick={() => onMoveClick(pen)}
            className="font-medium text-primary hover:underline cursor-pointer"
          >
            Move Cattle →
          </button>
        )}
      </div>
    </div>
  );
}
