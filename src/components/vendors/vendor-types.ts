import type { Vendor, VendorType } from "@/types/database";
import type { Dictionary } from "@/i18n/getDictionary";

export type EnrichedVendor = Vendor & {
  cattleCount: number;
  totalPurchase: number;
  itemCount: number;
};

export type SortKey = "spend-desc" | "cattle-desc" | "name-asc" | "newest";

export const TYPE_LABEL = (t: Dictionary): Record<VendorType, string> => ({
  cattle: t.vendors.cattle,
  feed: t.vendors.feed,
  medicine: t.vendors.medicine,
  other: t.vendors.other,
});

export const TYPE_COLOR: Record<VendorType, string> = {
  cattle: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50",
  feed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50",
  medicine: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50",
  other: "bg-muted text-muted-foreground border border-border",
};

export function fmtBdt(n: number) {
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}
