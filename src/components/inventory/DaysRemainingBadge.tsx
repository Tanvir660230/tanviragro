import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert } from "lucide-react";

interface Props {
  stock: number;
  avgDailyConsumption: number | null;
  className?: string;
}

export function DaysRemainingBadge({ stock, avgDailyConsumption, className }: Props) {
  if (!avgDailyConsumption || avgDailyConsumption <= 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground/80 font-normal", className)}>
        <Clock className="h-3 w-3 opacity-50" />
        <span>—</span>
      </span>
    );
  }

  const days = stock / avgDailyConsumption;
  const rounded = Math.round(days);

  if (stock <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
          className
        )}
      >
        <ShieldAlert className="h-3 w-3 shrink-0" />
        <span>0d (Out)</span>
      </span>
    );
  }

  if (rounded < 5) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 tabular-nums animate-pulse",
          className
        )}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>Critical ~{rounded}d</span>
      </span>
    );
  }

  if (rounded < 10) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tabular-nums",
          className
        )}
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>Reorder ~{rounded}d</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums",
        className
      )}
    >
      <CheckCircle2 className="h-3 w-3 shrink-0 opacity-70" />
      <span>~{rounded}d</span>
    </span>
  );
}

