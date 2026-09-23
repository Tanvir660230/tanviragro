"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Calendar,
  DollarSign,
  HeartPulse,
  RefreshCw,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/ui/print-button";
import { CustomReportBuilderModal } from "@/components/report/CustomReportBuilderModal";
import type { DashboardPayload } from "@/lib/analytics/aggregation-service";
import type { ExecutiveRoleSlug } from "@/lib/analytics/types";

function fmtBdt(n: number) {
  return "৳" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n));
}

function fmtNum(n: number, decimals = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(n);
}

const ROLE_OPTIONS: { slug: ExecutiveRoleSlug; label: string }[] = [
  { slug: "ceo", label: "CEO Dashboard" },
  { slug: "farm_manager", label: "Farm Manager" },
  { slug: "finance_manager", label: "Finance & Accounts" },
  { slug: "veterinarian", label: "Veterinarian Health" },
  { slug: "inventory_manager", label: "Inventory & Feed" },
  { slug: "operations_manager", label: "Operations Log" },
  { slug: "sales_manager", label: "Sales & Qurbani" },
  { slug: "system_admin", label: "Admin & Governance" },
];

export function ExecutiveAnalyticsHub({ initialData }: { initialData: DashboardPayload }) {
  const [selectedRole, setSelectedRole] = useState<ExecutiveRoleSlug>(initialData.role || "ceo");
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const { summary, alerts, monthlyTrends, forecast, dashboardConfig } = data;

  async function switchRole(role: ExecutiveRoleSlug) {
    setSelectedRole(role);
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/kpis?role=${role}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error("Failed to switch role:", e);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const rows = [
      ["Executive Analytics Summary", data.dashboardConfig.roleTitle],
      ["Generated At", data.asOf],
      [],
      ["FINANCIAL KPIS", "Value"],
      ["Total Revenue (BDT)", summary.financial.totalRevenue],
      ["Operating Expense (BDT)", summary.financial.totalOperatingExpense],
      ["Net Farm Profit (BDT)", summary.financial.netFarmProfit],
      ["Gross Margin (%)", summary.financial.grossMarginPercent],
      ["Cash Runway (Days)", summary.financial.cashRunwayDays],
      ["Cost Per Kg Gain (BDT)", summary.financial.costPerKgGain],
      [],
      ["BIOLOGICAL HERD KPIS", "Value"],
      ["Active Head Count", summary.biological.activeHeadCount],
      ["Total Live Biomass (kg)", summary.biological.totalLiveBiomassKg],
      ["Average Weight (kg)", summary.biological.averageWeightKg],
      ["Average Daily Gain (kg/day)", summary.biological.averageDailyGainKg],
      ["Mortality Rate (%)", summary.biological.mortalityRatePercent],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics_${selectedRole}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* ── Top Role Selector Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-3 rounded-2xl border border-border/70 print:hidden">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Role:</span>
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.slug}
              onClick={() => switchRole(opt.slug)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedRole === opt.slug
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background/80 hover:bg-muted text-foreground border border-border/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => switchRole(selectedRole)}
            disabled={loading}
            className="text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBuilder(true)}
            className="text-xs h-8 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Report Builder
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs h-8">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
          <PrintButton />
        </div>
      </div>
      {/* ── Role Header & Mission ── */}
      <div className="border-b border-border/60 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{dashboardConfig.roleTitle}</span>
              <Badge variant="outline" className="text-xs font-normal">
                Real-Time BI
              </Badge>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{dashboardConfig.description}</p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-muted-foreground">Snapshot As Of</span>
            <p className="text-xs font-mono font-semibold text-foreground">
              {new Date(data.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Alert & Risk Hierarchy Feed (If any) ── */}
      {alerts && alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Actionable Operations &amp; Risk Alerts ({alerts.length})
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {alerts.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="bg-background/90 p-2.5 rounded-lg border border-border/60 text-xs space-y-1 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground truncate">{a.title}</span>
                  <Badge
                    variant={a.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[10px] uppercase h-4 px-1"
                  >
                    {a.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px] line-clamp-2">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Core Executive Scorecards Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Revenue / Net Profit */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Farm Profit</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {fmtBdt(summary.financial.netFarmProfit)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px]">
              <span
                className={`font-semibold flex items-center ${
                  summary.financial.grossMarginPercent >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {summary.financial.grossMarginPercent >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {summary.financial.grossMarginPercent}%
              </span>
              <span className="text-muted-foreground">Gross Margin</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Biomass & ADG */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Herd Live Biomass</span>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {fmtNum(summary.biological.totalLiveBiomassKg, 0)} kg
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px]">
              <span className="font-semibold text-emerald-600 flex items-center">
                <TrendingUp className="h-3 w-3 mr-0.5" />
                {summary.biological.averageDailyGainKg} kg/d
              </span>
              <span className="text-muted-foreground">ADG ({summary.biological.activeHeadCount} head)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Asset Valuation & Net Equity */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Farm Equity</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {fmtBdt(summary.financial.netEquity)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
              <span>Bio: {fmtBdt(summary.financial.totalBiologicalAssetValue)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Runway & Health Compliance */}
        <Card className="shadow-sm">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cash &amp; Health Runway</span>
            <HeartPulse className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {summary.financial.cashRunwayDays} Days
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
              <span className="text-emerald-600 font-semibold">{summary.health.vaccinationComplianceRate}%</span>
              <span>Vaccine Compliance</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Visual Analytics & Trend Engine ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: 6-Month Monthly Trend Matrix */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                6-Month Revenue, OpEx &amp; Feed Cost Trend
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Audited Series
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-2 font-medium">Month</th>
                    <th className="pb-2 font-medium text-right">Revenue</th>
                    <th className="pb-2 font-medium text-right">OpEx</th>
                    <th className="pb-2 font-medium text-right">Feed Cost</th>
                    <th className="pb-2 font-medium text-right">Net Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {monthlyTrends.map((t) => (
                    <tr key={t.monthKey} className="hover:bg-muted/30">
                      <td className="py-2.5 font-semibold text-foreground">{t.label}</td>
                      <td className="py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {fmtBdt(t.revenue)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                        {fmtBdt(t.expense)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                        {fmtBdt(t.feedCost)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono font-bold ${
                          t.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {fmtBdt(t.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Right: Linear Regression Predictive Forecast */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Predictive AI Growth &amp; Feed Run
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                M+1 to M+3
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Projected Live Biomass (kg)</span>
              <div className="space-y-1.5 mt-2">
                {forecast.biomassGrowth.map((pt) => (
                  <div
                    key={pt.timestamp}
                    className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg"
                  >
                    <span className="font-semibold text-foreground">{pt.label}</span>
                    <span className="font-mono font-bold text-primary">{fmtNum(pt.value, 0)} kg</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <span className="text-xs font-medium text-muted-foreground">Unit Economics Overview</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-muted/30 p-2 rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground">Cost/kg Gain</span>
                  <p className="text-xs font-bold text-foreground">{fmtBdt(summary.financial.costPerKgGain)}</p>
                </div>
                <div className="bg-muted/30 p-2 rounded-lg text-center">
                  <span className="text-[10px] text-muted-foreground">Break-Even/kg</span>
                  <p className="text-xs font-bold text-foreground">
                    {fmtBdt(summary.financial.breakEvenPricePerKg)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Custom Report Builder Modal ── */}
      {showBuilder && <CustomReportBuilderModal onClose={() => setShowBuilder(false)} />}
    </div>
  );
}
