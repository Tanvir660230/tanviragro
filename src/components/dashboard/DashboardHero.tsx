import { ClientDate } from "@/components/shared/ClientDate";
import { fmtBDT } from "@/lib/format";
import type { DashboardStats } from "@/lib/supabase/queries/dashboard";
import type { Dictionary, Locale } from "@/i18n/getDictionary";

interface Props {
  stats: DashboardStats;
  t: Dictionary;
  locale: Locale;
}

export function DashboardHero({ stats, t, locale }: Props) {
  const isProfit = stats.totalSales > 0 && stats.netProfitLoss > 0;
  
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border/60 shadow-sm animate-fade-in-up">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.dashboard.welcome}
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <ClientDate locale={locale} />
        </p>
      </div>
      
      {stats.totalSales > 0 && (
        <div className="flex items-center gap-4 bg-muted/30 px-5 py-3 rounded-xl border border-border/50">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Realized {t.dashboard.net_pl}
            </p>
            <p className={`text-xl font-bold tabular-nums ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {isProfit ? '+' : ''}{fmtBDT(stats.netProfitLoss)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
