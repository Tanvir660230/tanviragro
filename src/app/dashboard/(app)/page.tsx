import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getDictionary } from "@/i18n/getDictionary";
import { cookies } from "next/headers";
import type { Locale } from "@/i18n/getDictionary";
import { DashboardDataService } from "@/lib/services/dashboard.service";
import { AnalyticsAggregationService } from "@/lib/analytics/aggregation-service";
import type { OperationalAlertItem } from "@/lib/analytics/types";
import type { AttentionItem } from "@/components/dashboard/CommandCenterBanner";
import Link from "next/link";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { EnterpriseDashboard } from "@/components/dashboard/EnterpriseDashboard";
import { EidCountdownCard } from "@/components/dashboard/EidCountdownCard";
import { TodayTasksCard } from "@/components/dashboard/TodayTasksCard";
import { FarmFeedSummaryCard } from "@/components/dashboard/FarmFeedSummaryCard";
import { CashFlowForecastCard } from "@/components/dashboard/CashFlowForecastCard";
import { CashBalanceCard } from "@/components/dashboard/CashBalanceCard";

export const revalidate = 0; // Ensures fresh data for the dashboard

/** Maps the backend AlertEngine output into the CommandCenterBanner UI format */
function toAttentionItems(alerts: OperationalAlertItem[]): AttentionItem[] {
  return alerts.slice(0, 6).map((a) => ({
    id: a.id,
    type: a.severity === "high" ? "critical" : a.severity === "medium" ? "warning" : "info",
    title: a.title,
    subtitle: a.description,
    href: a.actionUrl ?? "/dashboard",
  }));
}

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
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all"
        >
          Go to Onboarding
        </Link>
      </div>
    );
  }

  // Fetch unified dashboard payload through the centralized Dashboard Data Service
  const dashboardData = await DashboardDataService.getUnifiedDashboardData(supabase, businessId, t);
  const { stats, activities, valuation, insights, healthScore, monthlyPoints, trends } = dashboardData;

  // Wire the AlertEngine + analytics pipeline for the Command Center banner
  let attentionItems: AttentionItem[] | undefined;
  try {
    const execData = await AnalyticsAggregationService.getExecutiveDashboardData(supabase, businessId, "ceo");
    attentionItems = toAttentionItems(execData.alerts);
  } catch {
    // Fall back to hiding the banner when analytics are unavailable
    attentionItems = undefined;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Executive Hero Header — global farm health pulse */}
      <DashboardHero stats={stats} healthScore={healthScore} valuation={valuation} t={t} locale={locale} />

      {/* 2. Enterprise Operational Command Center Experience */}
      <EnterpriseDashboard
        stats={stats}
        activities={activities}
        valuation={valuation}
        insights={insights}
        healthScore={healthScore}
        monthlyPoints={monthlyPoints}
        trends={trends}
        attentionItems={attentionItems}
        todayTasksSlot={<TodayTasksCard />}
        farmFeedSummarySlot={<FarmFeedSummaryCard />}
        cashFlowForecastSlot={<CashFlowForecastCard />}
        eidCountdownSlot={<EidCountdownCard />}
        cashBalanceSlot={<CashBalanceCard />}
        t={t}
        locale={locale}
      />
    </div>
  );
}
