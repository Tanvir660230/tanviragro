"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import {
  Sparkles, AlertTriangle, CheckCircle2, ShoppingCart, Brain, Zap, BarChart3,
  TrendingUp, ShieldCheck, Package, Clock, Target, Lightbulb, RefreshCcw,
} from "lucide-react";
import type { ItemStockSummary } from "@/lib/inventory/types";

type MoveRow = { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string };

interface AIInsight {
  id: string;
  type: "reorder" | "anomaly" | "optimization" | "trend" | "warning" | "recommendation" | "forecast";
  severity: "critical" | "warning" | "info" | "success";
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  metric?: string;
  items?: { name: string; detail: string }[];
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  critical: { bg: "bg-rose-500/5", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20", iconBg: "bg-rose-500/15" },
  warning: { bg: "bg-amber-500/5", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", iconBg: "bg-amber-500/15" },
  info: { bg: "bg-blue-500/5", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20", iconBg: "bg-blue-500/15" },
  success: { bg: "bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", iconBg: "bg-emerald-500/15" },
};

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function AIInsightsFullPage({ portfolio, movements }: { portfolio: ItemStockSummary[]; movements: MoveRow[] }) {
  const insights = useMemo<AIInsight[]>(() => {
    const result: AIInsight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    // ── 1. Out-of-stock items ─────────────────────────────────────
    const outOfStock = portfolio.filter((p) => p.currentStock <= 0 && !p.isDiscontinued);
    if (outOfStock.length > 0) {
      result.push({
        id: "oos",
        type: "warning",
        severity: "critical",
        icon: AlertTriangle,
        title: `${outOfStock.length} Item${outOfStock.length > 1 ? "s" : ""} Out of Stock`,
        description: "These items have zero stock on hand and require immediate replenishment.",
        action: "Create purchase orders immediately to prevent production delays.",
        metric: outOfStock.map((p) => p.itemName).join(", "),
        items: outOfStock.map((p) => ({ name: p.itemName, detail: `Category: ${p.category}` })),
      });
    }

    // ── 2. Low stock alerts ───────────────────────────────────────
    const lowStock = portfolio.filter((p) => p.isLowStock && p.currentStock > 0 && !p.isDiscontinued);
    if (lowStock.length > 0) {
      result.push({
        id: "low",
        type: "reorder",
        severity: "warning",
        icon: ShoppingCart,
        title: `${lowStock.length} Item${lowStock.length > 1 ? "s" : ""} Below Reorder Level`,
        description: "Stock is approaching the minimum threshold. Schedule replenishment within 7 days.",
        action: "Review and place purchase orders for these items.",
        metric: `${lowStock.length} items need attention`,
        items: lowStock.map((p) => ({
          name: p.itemName,
          detail: `Stock: ${p.currentStock.toFixed(1)} ${p.unit} (threshold: ${p.lowStockThreshold ?? "—"})`,
        })),
      });
    }

    // ── 3. Critically low (days of supply < 3) ────────────────────
    // Compute avg daily consumption from movements
    const consumptionByItem = new Map<string, number>();
    for (const m of movements) {
      if (m.type === "consumption") {
        consumptionByItem.set(m.item_id, (consumptionByItem.get(m.item_id) ?? 0) + m.qty);
      }
    }
    const critical: { item: ItemStockSummary; daysLeft: number }[] = [];
    for (const p of portfolio) {
      if (p.currentStock <= 0 || p.isDiscontinued) continue;
      const consumed30d = consumptionByItem.get(p.itemId) ?? 0;
      if (consumed30d > 0) {
        const avgDaily = consumed30d / 30;
        const daysLeft = p.currentStock / avgDaily;
        if (daysLeft < 3) critical.push({ item: p, daysLeft });
      }
    }
    // ── 4. Overstock detection (> 90 days supply) ─────────────────
    const overstocked: { item: ItemStockSummary; daysSupply: number }[] = [];
    for (const p of portfolio) {
      if (p.currentStock <= 0 || p.isDiscontinued) continue;
      const consumed30d = consumptionByItem.get(p.itemId) ?? 0;
      if (consumed30d > 0) {
        const avgDaily = consumed30d / 30;
        const daysSupply = p.currentStock / avgDaily;
        if (daysSupply > 90) overstocked.push({ item: p, daysSupply });
      }
    }
    if (overstocked.length > 0) {
      overstocked.sort((a, b) => b.daysSupply - a.daysSupply);
      result.push({
        id: "overstock",
        type: "optimization",
        severity: "info",
        icon: BarChart3,
        title: `${overstocked.length} Overstocked Item${overstocked.length > 1 ? "s" : ""}`,
        description: "These items have excess supply that may tie up capital or risk expiry.",
        action: "Reduce future purchase quantities and review consumption patterns.",
        metric: `${Math.round(overstocked[0].daysSupply)} days max supply`,
        items: overstocked.slice(0, 6).map((o) => ({
          name: o.item.itemName,
          detail: `~${Math.round(o.daysSupply)} days supply · ৳${Math.round(o.item.totalValuation).toLocaleString("en-IN")} tied up`,
        })),
      });
    }

    // ── 5. Demand forecast (consumption trend) ────────────────────
    const totalConsumed = Array.from(consumptionByItem.values()).reduce((s, v) => s + v, 0);
    const uniqueConsumers = consumptionByItem.size;
    if (totalConsumed > 0) {
      const avgDailyTotal = totalConsumed / 30;
      const monthlyProjection = Math.round(avgDailyTotal * 30);
      const weeklyProjection = Math.round(avgDailyTotal * 7);
      result.push({
        id: "forecast",
        type: "forecast",
        severity: "info",
        icon: TrendingUp,
        title: "30-Day Demand Forecast",
        description: `Based on recent consumption patterns across ${uniqueConsumers} active items.`,
        metric: `~${weeklyProjection.toLocaleString("en-IN")}/week · ~${monthlyProjection.toLocaleString("en-IN")}/month`,
      });
    }

    // ── 6. Anomaly: items without cost data ───────────────────────
    const noCost = portfolio.filter((p) => p.averageUnitCost == null && p.currentStock > 0 && !p.isDiscontinued);
    if (noCost.length > 0) {
      result.push({
        id: "nocost",
        type: "anomaly",
        severity: "warning",
        icon: ShieldCheck,
        title: `${noCost.length} Item${noCost.length > 1 ? "s" : ""} Without Purchase Cost`,
        description: "Inventory valuation is inaccurate for these items. Purchase costs are missing.",
        action: "Record costs for accurate stock valuation and reporting.",
        metric: `~৳${Math.round(noCost.reduce((s, p) => s + p.currentStock, 0)).toLocaleString("en-IN")} unvalued`,
        items: noCost.map((p) => ({ name: p.itemName, detail: `Stock: ${p.currentStock.toFixed(1)} ${p.unit} · No cost recorded` })),
      });
    }

    // ── 7. Inventory health score ─────────────────────────────────
    const activeItems = portfolio.filter((p) => !p.isDiscontinued);
    const healthy = activeItems.filter((p) => p.currentStock > 0 && !p.isLowStock);
    const healthPct = activeItems.length > 0 ? Math.round((healthy.length / activeItems.length) * 100) : 100;
    result.push({
      id: "health",
      type: "recommendation",
      severity: healthPct >= 80 ? "success" : healthPct >= 50 ? "info" : "warning",
      icon: Target,
      title: `Inventory Health Score: ${healthPct}%`,
      description: `${healthy.length} of ${activeItems.length} active items at optimal stock levels.`,
      metric: `${healthPct}%`,
    });

    // ── 8. Category insights ──────────────────────────────────────
    const categories = ["feed", "roughage", "medicine", "equipment"];
    const catInsights: { name: string; count: number; value: number; alerts: number }[] = [];
    for (const cat of categories) {
      const items = activeItems.filter((p) => p.category === cat);
      if (items.length === 0) continue;
      const value = items.reduce((s, p) => s + p.totalValuation, 0);
      const alerts = items.filter((p) => p.isLowStock || p.currentStock <= 0).length;
      catInsights.push({ name: cat, count: items.length, value, alerts });
    }
    if (catInsights.length > 0) {
      const totalVal = catInsights.reduce((s, c) => s + c.value, 0);
      const totalAlerts = catInsights.reduce((s, c) => s + c.alerts, 0);
      result.push({
        id: "category",
        type: "recommendation",
        severity: totalAlerts > 3 ? "warning" : "success",
        icon: Lightbulb,
        title: "Category Health Overview",
        description: `Across ${catInsights.length} categories: ${totalAlerts > 0 ? `${totalAlerts} alerts need attention` : "all categories healthy"}.`,
        metric: `৳${Math.round(totalVal).toLocaleString("en-IN")} total value`,
      });
    }

    return result;
  }, [portfolio, movements]);

  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const warningCount = insights.filter((i) => i.severity === "warning").length;
  const successCount = insights.filter((i) => i.severity === "success").length;

  const sortedInsights = useMemo(() => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2, success: 3 };
    return [...insights].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [insights]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> {insights.length} insight{insights.length !== 1 ? "s" : ""} generated
        </span>
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {warningCount} warning{warningCount !== 1 ? "s" : ""}
          </span>
        )}
        {successCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {successCount} healthy
          </span>
        )}
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        {sortedInsights.map((ins) => {
          const sev = SEVERITY_CONFIG[ins.severity];
          const Ico = ins.icon;
          return (
            <div key={ins.id} className={cn("rounded-2xl border bg-card overflow-hidden transition-all", sev.border)}>
              <div className="flex items-start gap-4 p-5">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", sev.iconBg)}>
                  <Ico className={cn("h-5 w-5", sev.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{ins.title}</h3>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border", sev.iconBg, sev.text, sev.border)}>
                      {ins.severity}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize">
                      {ins.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{ins.description}</p>

                  {ins.action && (
                    <p className="text-xs text-primary/80 font-medium mb-2">→ {ins.action}</p>
                  )}

                  {ins.metric && (
                    <span className="inline-flex rounded-md bg-muted/60 px-2.5 py-1 text-[11px] font-mono font-semibold text-foreground border border-border/40">
                      {ins.metric}
                    </span>
                  )}

                  {/* Affected items list */}
                  {ins.items && ins.items.length > 0 && (
                    <div className="mt-3 rounded-xl border border-border/40 bg-muted/20 divide-y divide-border/30">
                      {ins.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="text-xs font-medium text-foreground truncate">{item.name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
          <div>
            <p className="font-medium text-foreground">All Systems Optimal</p>
            <p className="text-sm text-muted-foreground">No inventory issues detected. Your stock levels are healthy.</p>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground border border-border/60 rounded-xl bg-muted/20 px-4 py-3">
        <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
        Insights are computed algorithmically from your inventory data. Consumption patterns are based on the last 30 days of transaction history.
      </div>
    </div>
  );
}