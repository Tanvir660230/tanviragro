"use client";

import React, { useState, Suspense } from "react";
import { useDashboardPersonalization } from "./engine/PersonalizationContext";
import { DashboardToolbar } from "./DashboardToolbar";
import { CommandCenterBanner, AttentionItem } from "./CommandCenterBanner";
import { ActionCenterDialogs } from "./ActionCenterDialogs";
import { SectionCard } from "@/components/shared/SectionCard";
import { RevenueVsCostChartWrapper } from "./RevenueVsCostChartWrapper";
import { PortfolioHealthCard } from "./PortfolioHealthCard";
import { InsightsPanel } from "./InsightsPanel";
import { LiveHerdValueCard } from "./LiveHerdValueCard";
import { QuickActionsBar } from "./QuickActionsBar";
import { BarChart3, Activity } from "lucide-react";
import type { Dictionary } from "@/i18n/types";

export type EnterpriseDashboardProps = {
  stats: any;
  activities: any;
  valuation: any;
  insights: any;
  healthScore: any;
  monthlyPoints: any;
  trends: any;
  attentionItems: any;
  todayTasksSlot: any;
  farmFeedSummarySlot: any;
  cashFlowForecastSlot: any;
  eidCountdownSlot: any;
  cashBalanceSlot: any;
  t: any;
  locale: any;
};

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 animate-pulse" role="status" aria-label={`Loading ${label}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-xl bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
      </div>
    </div>
  );
}

export function EnterpriseDashboardLayout(p: EnterpriseDashboardProps) {
  // const { visibleWidgetIds } = useDashboardPersonalization(); 
  const [modal, setModal] = useState<"expense" | "sale" | "feed" | "weight" | null>(null);

  const alerts: AttentionItem[] = p.attentionItems ?? [];
  const valuation = p.valuation ?? {
      activeCattleCount: 0,
      totalEstimatedValue: 0,
      totalCostBasis: 0,
      unrealizedProfit: 0,
      marketPricePerKg: 0,
      readyToSellCattle: [],
      totalEstimatedWeightKg: 0,
      averageWeightKg: 0,
  };

  return (
    <div className="space-y-12 pb-12">
      <DashboardToolbar />

      <QuickActionsBar t={p.t} onOpenModal={(type) => setModal(type)} />

      {/* SECTION 1: Executive Pulse & Key Metrics */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Executive Pulse &amp; Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <LiveHerdValueCard valuation={valuation} />
            {p.cashBalanceSlot}
            <PortfolioHealthCard health={p.healthScore} t={p.t} />
            {p.eidCountdownSlot}
        </div>
      </section>

      {/* SECTION 3 & 4: Selling Opportunities & Weight & Growth */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SectionCard title="Selling Opportunities" icon={BarChart3}>
            {valuation.readyToSellCattle.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No cattle currently meet profitability targets for sale.</p>
            ) : (
                <ul className="divide-y divide-border">
                  {valuation.readyToSellCattle.map((c: any) => (
                    <li key={c.id} className="flex justify-between p-3 text-sm">
                      <span>#{c.tagId}</span>
                      <span className="font-semibold text-emerald-600">+{c.profit.toLocaleString()} BDT (ROI: {c.roi.toFixed(1)}%)</span>
                    </li>
                  ))}
                </ul>
            )}
          </SectionCard>
          <SectionCard title="Weight & Growth" icon={Activity}>
             <div className="p-4 space-y-4">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average Weight</span>
                    <span className="font-semibold">{valuation.averageWeightKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Estimated Weight</span>
                    <span className="font-semibold">{valuation.totalEstimatedWeightKg.toFixed(0)} kg</span>
                </div>
             </div>
          </SectionCard>
      </section>

      {/* SECTION 5 & 6: Financial & Feed Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Financial Overview</h2>
            <RevenueVsCostChartWrapper data={p.monthlyPoints} />
          </div>
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Feed Overview</h2>
            {p.farmFeedSummarySlot}
          </div>
      </section>

      {/* SECTION 7 & 8: Health Alerts & Today's Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Health & Farm Alerts</h2>
            <CommandCenterBanner items={alerts} />
          </div>
          
          <div className="space-y-6">
            <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Today's Actions</h2>
            {p.todayTasksSlot}
          </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">AI Insights</h2>
        <SectionCard title="Insights" icon={Activity}>
             <InsightsPanel insights={p.insights} t={p.t} />
        </SectionCard>
      </section>

      <ActionCenterDialogs activeModal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

