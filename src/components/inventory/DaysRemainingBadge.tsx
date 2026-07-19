import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  stock: number;
  avgDailyConsumption: number | null;
}

export function DaysRemainingBadge({ stock, avgDailyConsumption }: Props) {
  if (!avgDailyConsumption || avgDailyConsumption <= 0) {
    return <span className="text-xs text-muted-foreground">No data</span>;
  }

  const days = stock / avgDailyConsumption;
  const rounded = Math.round(days);

  if (rounded < 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" />
        Critical ~{rounded}d
      </span>
    );
  }

  if (rounded < 10) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
        <RefreshCw className="h-3 w-3" />
        Reorder ~{rounded}d
      </span>
    );
  }

  return (
    <span className={cn("text-xs font-medium text-emerald-600 dark:text-emerald-400 tabular-nums")}>
      ~{rounded}d
    </span>
  );
}
