import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pct: number;
  /** When true, higher is worse (e.g. investment cost) */
  inverted?: boolean;
}

export function TrendBadge({ pct, inverted = false }: Props) {
  const isPositive = inverted ? pct <= 0 : pct >= 0;
  const isFlat = Math.abs(pct) < 0.5;

  const Icon = isFlat ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        isFlat
          ? "bg-muted text-muted-foreground"
          : isPositive
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
      )}
    >
      <Icon className="h-3 w-3" />
      {isFlat ? "—" : Math.abs(pct) > 999 ? "999%+" : `${Math.abs(pct).toFixed(1)}%`}
    </span>
  );
}
