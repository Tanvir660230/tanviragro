"use client";

import { ServiceStatus, OverallSystemStatus } from "@/lib/monitoring/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Clock } from "lucide-react";

export function StatusPulse({
  status,
  size = "md",
}: {
  status: ServiceStatus | OverallSystemStatus;
  size?: "sm" | "md" | "lg";
}) {
  const isOk = status === "healthy" || status === "OPERATIONAL";
  const isDegraded = status === "degraded" || status === "DEGRADED";
  const isDown = status === "down" || status === "CRITICAL_OUTAGE";
  const isUnconfigured = status === "unconfigured";

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3.5 w-3.5",
  };

  const pingClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3.5 w-3.5",
  };

  return (
    <span className="relative flex items-center justify-center shrink-0">
      {isOk && (
        <>
          <span className={cn("animate-ping absolute inline-flex rounded-full bg-emerald-400 opacity-75", pingClasses[size])} />
          <span className={cn("relative inline-flex rounded-full bg-emerald-500", sizeClasses[size])} />
        </>
      )}
      {isDegraded && (
        <>
          <span className={cn("animate-ping absolute inline-flex rounded-full bg-amber-400 opacity-75", pingClasses[size])} />
          <span className={cn("relative inline-flex rounded-full bg-amber-500", sizeClasses[size])} />
        </>
      )}
      {isDown && (
        <>
          <span className={cn("animate-ping absolute inline-flex rounded-full bg-rose-500 opacity-75", pingClasses[size])} />
          <span className={cn("relative inline-flex rounded-full bg-rose-600", sizeClasses[size])} />
        </>
      )}
      {isUnconfigured && (
        <span className={cn("relative inline-flex rounded-full bg-slate-400 dark:bg-slate-600", sizeClasses[size])} />
      )}
    </span>
  );
}

export function ServiceStatusBadge({
  status,
  className,
}: {
  status: ServiceStatus;
  className?: string;
}) {
  switch (status) {
    case "healthy":
      return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800", className)}>
          <CheckCircle2 className="h-3 w-3" />
          Healthy
        </span>
      );
    case "degraded":
      return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800", className)}>
          <AlertTriangle className="h-3 w-3" />
          Degraded
        </span>
      );
    case "down":
      return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-800", className)}>
          <XCircle className="h-3 w-3" />
          Outage
        </span>
      );
    case "unconfigured":
      return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700", className)}>
          <Clock className="h-3 w-3" />
          Optional / N/A
        </span>
      );
    default:
      return (
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border", className)}>
          <HelpCircle className="h-3 w-3" />
          Unknown
        </span>
      );
  }
}
