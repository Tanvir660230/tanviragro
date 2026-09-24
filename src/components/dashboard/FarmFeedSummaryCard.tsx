import { Wheat, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { loadFeedData } from "@/lib/feed/feed-data";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Dashboard feed card — from THE feed engine (lib/feed/usage-engine.ts), so it shows the
 * same numbers as the Feed Usage page. Actual, running estimate and items needing
 * attention are shown separately, never as one mixed "feed cost".
 */
export async function FarmFeedSummaryCard() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const t = await getDictionary();
  const { snapshot, items, periods, asOf } = await loadFeedData(supabase, businessId);
  const month = snapshot.byMonth[asOf.slice(0, 7)] ?? { actual: 0, estimated: 0 };
  const inUse = periods.filter((p) => p.status === "open");
  const attention = periods.filter((p) => p.status === "unreconciled").length + (snapshot.totals.recordedMissingCost > 0 ? 1 : 0);
  const nearEmpty = items
    .filter((i) => i.openPeriodId && i.daysLeft != null && i.daysLeft <= 7)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card animate-fade-in-up">
      <div className="relative flex-1 flex flex-col px-4 py-4 sm:px-6 sm:py-5 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Wheat className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t.feed_summary.title}</p>
              <p className="text-xs text-muted-foreground">
                {inUse.length > 0 ? `${inUse.length} feed${inUse.length === 1 ? "" : "s"} in use — daily use calculated automatically` : "No feed in use — start one on Feed Usage"}
              </p>
            </div>
          </div>
          <Link href="/dashboard/inventory/usage" className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            {t.dashboard_extra.view_all}<ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Actual · this month</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums">{taka(month.actual)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Running · estimated</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums">{taka(month.estimated)}</p>
          </div>
          <div className={cn("rounded-xl border p-3", attention ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/30" : "bg-muted/40 border-border/60")}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Needs attention</p>
            <p className={cn("text-lg sm:text-xl font-bold tabular-nums", attention ? "text-rose-600 dark:text-rose-400" : "")}>{attention}</p>
          </div>
        </div>

        {nearEmpty.length > 0 && (
          <ul className="space-y-1 text-xs">
            {nearEmpty.slice(0, 3).map((i) => (
              <li key={i.id} className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {i.name}: expected to finish in ≈ {Math.max(0, Math.floor(i.daysLeft ?? 0))} day{Math.floor(i.daysLeft ?? 0) === 1 ? "" : "s"} ({i.depletionDate}) — forecast
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
