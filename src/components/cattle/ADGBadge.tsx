import { cn } from "@/lib/utils";

interface Props {
  adg: number | null;
}

export function ADGBadge({ adg }: Props) {
  if (adg === null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const { label, className } =
    adg >= 0.5
      ? {
          label: "Good",
          className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
        }
      : adg >= 0.3
        ? {
            label: "Fair",
            className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
          }
        : {
            label: "Poor",
            className: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
          };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {adg.toFixed(2)} kg/d · {label}
    </span>
  );
}
