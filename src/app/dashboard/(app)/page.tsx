import { Suspense } from "react";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";
import type { Locale } from "@/i18n/getDictionary";
import { getDashboardStats, getRecentActivity } from "@/lib/supabase/queries/dashboard";
import { getLiveHerdValuation } from "@/lib/supabase/queries/valuation";
import { getSmartInsights, getPortfolioHealthScore } from "@/lib/supabase/queries/analytics";
import { Beef, CircleDollarSign, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import { fmtBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

// Components
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { StatCard } from "@/components/shared/StatCard";
import { LiveHerdValueCard } from "@/components/dashboard/LiveHerdValueCard";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { TodayTasksCard } from "@/components/dashboard/TodayTasksCard";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { CashBalanceCard } from "@/components/dashboard/CashBalanceCard";
import { FarmFeedSummaryCard } from "@/components/dashboard/FarmFeedSummaryCard";
import { CashFlowForecastCard } from "@/components/dashboard/CashFlowForecastCard";
import { FarmAdvisorPanel } from "@/components/dashboard/FarmAdvisorPanel";
import { EidCountdownCard } from "@/components/dashboard/EidCountdownCard";

export const revalidate = 0; // Ensures fresh data for the dashboard

export default async function DashboardPage() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en") as Locale;
  const t = await getDictionary(locale);

  if (!businessId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">No Business Found</h2>
        <p className="text-muted-foreground">Please create or join a business to view the dashboard.</p>
        <Link href="/onboarding" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
          Go to Onboarding
        </Link>
      </div>
    );
  }

  // Fetch all dashboard data in parallel
  const [stats, activities, valuation, insights, healthScore] = await Promise.all([
    getDashboardStats(supabase, businessId),
    getRecentActivity(supabase, businessId, t),
    getLiveHerdValuation(supabase, businessId),
    getSmartInsights(supabase, businessId, t),
    getPortfolioHealthScore(supabase, businessId),
  ]);

  return (
    <div className="space-y-6 pb-10">
      
      {/* 1. Dashboard Hero (Greeting & Net P&L Summary) */}
      <DashboardHero stats={stats} t={t} locale={locale} />
      
      {/* 2. Top-level Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up delay-75">
        <StatCard
          label={t.dashboard.active_cattle}
          value={stats.totalCattle.toString()}
          icon={Beef}
          subtext="Currently in farm"
          href="/dashboard/cattle"
        />
        <StatCard
          label="Cost Basis (Sold)"
          value={fmtBDT(stats.totalInvestment)}
          icon={Wallet}
          subtext="Total realized costs"
          accentColor="blue"
        />
        <StatCard
          label={t.dashboard.total_sales}
          value={fmtBDT(stats.totalSales)}
          icon={CircleDollarSign}
          subtext="Total revenue"
          accentColor="amber"
        />
        <StatCard
          label="Net Realized P&L"
          value={(stats.netProfitLoss > 0 ? "+" : "") + fmtBDT(stats.netProfitLoss)}
          icon={TrendingUp}
          subtext="Revenue minus realized costs"
          positive={stats.netProfitLoss > 0 ? true : stats.netProfitLoss < 0 ? false : undefined}
        />
      </div>

      {/* 3. Cash Balance and Live Herd Valuation (What-If) side-by-side */}
      <div className={cn(
        "grid gap-6 animate-fade-in-up delay-150",
        (valuation.activeCattleCount > 0 && valuation.marketPricePerKg > 0) ? "lg:grid-cols-2" : "lg:grid-cols-1"
      )}>
        <CashBalanceCard />
        <LiveHerdValueCard valuation={valuation} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12 animate-fade-in-up delay-150">
        
        {/* Main Column (Left/Center) */}
        <div className="space-y-6 lg:col-span-8">
          <QuickActionsBar t={t} />
          <TodayTasksCard />

          <div className="grid gap-6 sm:grid-cols-2">
            <FarmFeedSummaryCard />
            <CashFlowForecastCard />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">{t.dashboard.recent_activity}</h2>
              <Link href="/dashboard/settings/activity" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            {activities.length > 0 ? (
              <div className="rounded-xl border bg-card">
                <div className="divide-y">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-medium">{activity.label}</p>
                        <p className="text-sm text-muted-foreground">{activity.detail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.date).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column (Right) */}
        <div className="space-y-6 lg:col-span-4">
          <EidCountdownCard />
          <FarmAdvisorPanel />
          <InsightsPanel insights={insights} t={t} />
        </div>
      </div>
    </div>
  );
}
