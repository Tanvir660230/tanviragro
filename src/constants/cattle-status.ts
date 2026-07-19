import type { Cattle } from "@/types/database";

export const CATTLE_STATUS_STYLE: Record<Cattle["status"], string> = {
  active:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  sold:    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  dead:    "bg-muted text-muted-foreground",
  stolen:  "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};
