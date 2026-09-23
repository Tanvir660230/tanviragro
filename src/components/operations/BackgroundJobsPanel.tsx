"use client";

import { useEffect, useState } from "react";
import { BackgroundJobStatus } from "@/lib/monitoring/types";
import { 
  Workflow, 
  Database, 
  Bell, 
  CloudRain, 
  RotateCw, 
  CheckCircle2, 
  Clock, 
  WifiOff, 
  Layers
} from "lucide-react";
import { countQueued } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const JOB_ICONS = {
  backup: Database,
  cron: Bell,
  workflow: Workflow,
  offline_sync: WifiOff,
};

export function BackgroundJobsPanel({
  jobs,
}: {
  jobs: BackgroundJobStatus[];
}) {
  const [offlineCount, setOfflineCount] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "indexedDB" in window) {
      countQueued()
        .then(setOfflineCount)
        .catch(() => setOfflineCount(0));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Offline Sync State */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <WifiOff className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Client Offline Mutations Queue</h4>
            <p className="text-xs text-muted-foreground">IndexedDB database storage for weight logs and feed entries recorded while offline</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Pending Sync</span>
            <p className="text-lg font-bold font-mono text-foreground">
              {offlineCount !== null ? offlineCount : "0"} items
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2.5 py-1">
            Engine Ready
          </span>
        </div>
      </div>

      {/* Background Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => {
          const Icon = JOB_ICONS[job.type] || Layers;

          return (
            <div
              key={job.id}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs hover:shadow-md transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{job.name}</h4>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {job.type}
                    </span>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Schedule</span>
                  <p className="font-mono text-foreground mt-0.5 truncate">{job.schedule || "Realtime Trigger"}</p>
                </div>

                <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Last Execution</span>
                  <p className="font-mono text-foreground mt-0.5 truncate">{job.lastRun || "Idle"}</p>
                </div>
              </div>

              {job.itemsProcessed !== undefined && (
                <div className="text-[11px] font-mono text-muted-foreground flex items-center justify-between pt-1">
                  <span>Processed: {job.itemsProcessed} executions</span>
                  {job.durationMs !== undefined && <span>Avg duration: {job.durationMs}ms</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
