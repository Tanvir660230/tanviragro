"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

type Projection = {
  id: string;
  tag: string;
  currentWt: number;
  projectedWt: number;
  adg: number;
  isReady: boolean;
};

const SHOW_LIMIT = 6;

export function EidCattleList({
  projections,
  labels,
}: {
  projections: Projection[];
  labels: { more_cattle: string; no_weight_data: string; status_ready: string; status_developing: string; status_at_risk: string };
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? projections : projections.slice(0, SHOW_LIMIT);

  return (
    <div className="divide-y divide-border">
      {displayed.map((p) => {
        const statusClass = p.isReady
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
          : p.projectedWt >= 200
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
          : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400";

        return (
          <Link
            key={p.tag}
            href={`/dashboard/cattle/${p.id}`}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
          >
            {p.isReady ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : p.projectedWt >= 200 ? (
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium hover:text-primary transition-colors">#{p.tag}</p>
              <p className="text-xs text-muted-foreground">
                {p.currentWt}kg â†’ {p.projectedWt.toFixed(0)}kg
                {p.adg > 0 ? ` (ADG ${p.adg.toFixed(2)}kg/d)` : ` (${labels.no_weight_data})`}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", statusClass)}>
              {p.isReady ? labels.status_ready : p.projectedWt >= 200 ? labels.status_developing : labels.status_at_risk}
            </span>
          </Link>
        );
      })}
      {!showAll && projections.length > SHOW_LIMIT && (
        <div className="px-5 py-2.5">
          <button
            onClick={() => setShowAll(true)}
            aria-label={`Show all ${projections.length} cattle`}
            className="text-xs text-primary hover:underline font-medium"
          >
            +{projections.length - SHOW_LIMIT} {labels.more_cattle}
          </button>
        </div>
      )}
    </div>
  );
}
