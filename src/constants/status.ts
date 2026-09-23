import type { CattleStatus } from "@/types/database";

export const CATTLE_STATUSES: readonly CattleStatus[] = ["active", "sold", "dead", "stolen", "quarantined", "culled", "archived"] as const;

export const CATTLE_STATUS_LABELS: Record<CattleStatus, { en: string; bn: string }> = {
  active: { en: "Active", bn: "সক্রিয়" },
  sold:   { en: "Sold", bn: "বিক্রি" },
  dead:   { en: "Deceased", bn: "মৃত" },
  stolen: { en: "Stolen", bn: "হারিয়ে গেছে" },
  quarantined: { en: "Quarantined", bn: "কোয়ারেন্টাইন" },
  culled: { en: "Culled", bn: "বাতিল" },
  archived: { en: "Archived", bn: "আর্কাইভ" },
};

export const CATTLE_STATUS_STYLE: Record<CattleStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800",
  sold:   "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800",
  dead:   "bg-muted text-muted-foreground border border-border",
  stolen: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border border-red-300 dark:border-red-800",
  quarantined: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border border-orange-300 dark:border-orange-800",
  culled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-800",
  archived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-400 border border-slate-300 dark:border-slate-800",
};

export type LoanStatus = "active" | "paid" | "defaulted";
export const LOAN_STATUS_LABELS: Record<LoanStatus, { en: string; bn: string }> = {
  active: { en: "Active", bn: "চলমান" },
  paid:   { en: "Paid in Full", bn: "পরিশোধিত" },
  defaulted: { en: "Defaulted", bn: "খেলাপি" },
};

export type AssetStatus = "active" | "disposed" | "fully_depreciated";
