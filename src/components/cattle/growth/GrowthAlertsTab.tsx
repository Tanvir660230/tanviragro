"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { type GrowthAlert } from "@/lib/growth/types";
import { cn } from "@/lib/utils";

interface Props {
  alerts: GrowthAlert[];
  onAcknowledge: (cattleId: string, alertType: string) => void;
  onOpenWeighModal: (cattleId: string) => void;
}

export function GrowthAlertsTab({
  alerts,
  onAcknowledge,
  onOpenWeighModal,
}: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-card/40 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
        <h3 className="font-semibold text-sm">Herd Growth is Stable</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          No rapid weight drops, prolonged growth plateaus, or overdue weigh-ins detected across the herd.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Active Growth Anomalies & Warnings</h3>
          <p className="text-xs text-muted-foreground">
            {alerts.length} animal issues requiring management or veterinary attention
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert) => {
          const isCritical = alert.severity === "critical";
          const isWarning = alert.severity === "warning";

          return (
            <Card
              key={alert.id}
              className={cn(
                "border shadow-xs backdrop-blur-sm",
                isCritical && "border-rose-500/50 bg-rose-500/5",
                isWarning && "border-amber-500/50 bg-amber-500/5",
                !isCritical && !isWarning && "border-blue-500/50 bg-blue-500/5"
              )}
            >
              <CardHeader className="p-3.5 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isCritical ? (
                      <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                    ) : isWarning ? (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <Badge variant="outline" className="text-xs font-semibold px-2">
                      #{alert.tagId}
                    </Badge>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0",
                      isCritical && "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/10",
                      isWarning && "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10",
                      !isCritical && !isWarning && "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                    )}
                  >
                    {alert.severity}
                  </Badge>
                </div>
                <CardTitle className="text-xs font-bold mt-1 text-foreground">
                  {alert.title}
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {alert.message}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-3.5 pt-0 space-y-2.5">
                <div className="p-2 rounded-lg bg-background/60 border border-border/40 text-[11px] space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-primary" /> Recommended Protocol:
                  </span>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {alert.recommendation}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onAcknowledge(alert.cattleId, alert.type)}
                    className="text-[11px] text-muted-foreground hover:text-foreground h-7"
                  >
                    Dismiss
                  </Button>
                  {alert.actionType === "weigh" && (
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => onOpenWeighModal(alert.cattleId)}
                      className="text-xs h-7 px-3"
                    >
                      Weigh Animal Now
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
