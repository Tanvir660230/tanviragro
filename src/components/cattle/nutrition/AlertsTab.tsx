"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type NutritionAlert } from "@/lib/nutrition/nutrition-engine";

interface AlertsTabProps {
  alerts: NutritionAlert[];
}

export function AlertsTab({ alerts }: AlertsTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/80 text-muted-foreground space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-sm text-foreground">All Nutrition & Stock Checks Normal</p>
            <p className="text-xs">No low stock, missed feeding slots, or abnormal intake detected.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "p-4 rounded-xl border flex items-start justify-between gap-4 transition-all",
                alert.severity === "critical"
                  ? "bg-rose-500/5 border-rose-500/30"
                  : "bg-amber-500/5 border-amber-500/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg mt-0.5",
                    alert.severity === "critical" ? "bg-rose-500/20 text-rose-600" : "bg-amber-500/20 text-amber-600"
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-foreground">{alert.title}</h4>
                    <Badge
                      variant={alert.severity === "critical" ? "destructive" : "outline"}
                      className="text-[10px] uppercase font-bold"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3 text-blue-500" /> Action: {alert.recommendedAction}
                  </p>
                </div>
              </div>
              {alert.actionHref && (
                <Link href={alert.actionHref}>
                  <Button size="sm" variant="outline" className="text-xs">Resolve</Button>
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
