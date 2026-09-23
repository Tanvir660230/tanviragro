"use client";

import React from "react";
import { Flame, Clock, Heart, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type HeatRecord } from "@/lib/reproduction";

interface HeatMonitorTabProps {
  heatRecords: HeatRecord[];
  onOpenRecordHeat: () => void;
  onOpenInseminate: (record: HeatRecord) => void;
}

export function HeatMonitorTab({ heatRecords, onOpenRecordHeat, onOpenInseminate }: HeatMonitorTabProps) {
  const activeHeats = heatRecords.filter((h) => h.status === "active");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-2xl p-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" />
            Estrus &amp; Heat Detection Monitor
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            AM/PM Insemination Timing Rule: Cows detected in AM should be bred this PM (10-18h window).
          </p>
        </div>
        <Button onClick={onOpenRecordHeat} size="sm" className="gap-1.5 shrink-0 bg-rose-600 hover:bg-rose-700 text-white">
          <Heart className="h-4 w-4" />
          Log Estrus Heat
        </Button>
      </div>

      {heatRecords.length === 0 ? (
        <div className="text-center py-12 bg-card border rounded-2xl p-6">
          <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold text-sm">No heat observations recorded</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Record morning and evening estrus observations to receive automated AM/PM breeding window recommendations.
          </p>
          <Button onClick={onOpenRecordHeat} size="sm" variant="outline" className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Log Heat
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {heatRecords.map((h) => {
            const isActive = h.status === "active";
            const now = new Date();
            const start = new Date(h.optimalBreedingStart);
            const end = new Date(h.optimalBreedingEnd);
            const isWindowOpen = now >= start && now <= end;

            return (
              <div
                key={h.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? isWindowOpen
                      ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 shadow-sm"
                      : "bg-card border-border"
                    : "bg-muted/30 border-border opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{h.cattleTag || `Cow #${h.cattleId.slice(0, 6)}`}</span>
                      <Badge
                        variant={isActive ? (isWindowOpen ? "destructive" : "default") : "secondary"}
                        className="text-[10px] uppercase font-semibold"
                      >
                        {isActive ? (isWindowOpen ? "Breeding Window Open" : "Active Heat") : h.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {h.intensity.replace(/_/g, " ")} • {h.heatType}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Detected:
                    </span>
                    <span className="font-medium text-foreground">
                      {new Date(h.detectedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Optimal Window:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {h.observedBy && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Observed By:</span>
                      <span>{h.observedBy}</span>
                    </div>
                  )}
                </div>

                {isActive && (
                  <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                    <Button
                      onClick={() => onOpenInseminate(h)}
                      size="sm"
                      className="w-full gap-1.5 text-xs bg-primary hover:bg-primary/90"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Inseminate / Breed Cow
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
