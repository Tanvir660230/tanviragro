"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCcw, Brain, ShoppingCart, Zap, BarChart3, TrendingUp } from "lucide-react";
import type { InventoryRow } from "./InventoryTable";

interface Insight {
  id: string;
  type: "reorder" | "anomaly" | "optimization" | "trend" | "warning" | "recommendation";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  action?: string;
  metric?: string;
}

export default function InventoryAIInsights({ items, className }: { items: InventoryRow[]; className?: string }) {
  const [spinning, setSpinning] = useState(false);
  const insights = useMemo(() => {
    const result: Insight[] = [];
    const oos = items.filter((i) => i.stock <= 0);
    if (oos.length > 0) result.push({ id: "oos", type: "warning", severity: "critical", title: `${oos.length} out of stock`, description: oos.map((i) => i.name).slice(0, 3).join(", ") + (oos.length > 3 ? ` +${oos.length - 3}` : ""), action: "Create purchase orders immediately." });
    const low = items.filter((i) => i.stock > 0 && i.low_stock_threshold !== null && i.stock <= i.low_stock_threshold);
    if (low.length > 0) result.push({ id: "low", type: "reorder", severity: "warning", title: `${low.length} below reorder`, description: low.map((i) => `${i.name} (${i.stock.toFixed(1)} ${i.unit})`).slice(0, 3).join(", "), action: "Schedule replenishment within 7 days." });
    const crit = items.filter((i) => i.avgDailyConsumption && i.avgDailyConsumption > 0 && i.stock > 0 && i.stock / i.avgDailyConsumption < 3);
    if (crit.length > 0) result.push({ id: "crit", type: "warning", severity: "critical", title: `${crit.length} critically low`, description: crit.map((i) => `${i.name} (~${Math.round(i.stock / (i.avgDailyConsumption || 1))}d)`).slice(0, 3).join(", "), action: "Place emergency orders." });
    const over = items.filter((i) => i.avgDailyConsumption && i.avgDailyConsumption > 0 && i.stock / i.avgDailyConsumption > 90);
    if (over.length > 0) result.push({ id: "over", type: "optimization", severity: "info", title: "Potential overstock", description: `${over.length} item(s) with 90+ days supply.`, action: "Reduce future orders.", metric: `~${Math.round(over[0].stock / (over[0].avgDailyConsumption || 1))}d supply` });
    const noCost = items.filter((i) => i.currentCost == null);
    if (noCost.length > 0) result.push({ id: "nocost", type: "anomaly", severity: "warning", title: `${noCost.length} without cost data`, description: noCost.map((i) => i.name).slice(0, 3).join(", ") + " need purchase costs.", action: "Record costs for accurate valuation." });
    const healthy = items.filter((i) => i.stock > 0 && (i.low_stock_threshold === null || i.stock > i.low_stock_threshold));
    if (healthy.length > items.length * 0.8 && items.length > 0) result.push({ id: "good", type: "recommendation", severity: "success", title: "Inventory health excellent", description: `${Math.round((healthy.length / items.length) * 100)}% at optimal levels.`, metric: `${healthy.length}/${items.length}` });
    const tv = items.reduce((s, i) => s + i.stock * (i.currentCost || 0), 0);
    if (tv > 0) result.push({ id: "val", type: "recommendation", severity: "success", title: "Inventory valuation", description: `Total stock: ৳${Math.round(tv).toLocaleString("en-IN")}.`, metric: `৳${Math.round(tv).toLocaleString("en-IN")}` });
    return result;
  }, [items]);

  if (insights.length === 0) return null;

  const SEV: Record<string, { icon: string; badge: string; El: React.ElementType }> = {
    critical: { icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400", badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400", El: AlertTriangle },
    warning: { icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", El: AlertTriangle },
    info: { icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400", El: Brain },
    success: { icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", El: CheckCircle2 },
  };
  const TI: Record<string, React.ElementType> = { reorder: ShoppingCart, anomaly: Zap, optimization: BarChart3, trend: TrendingUp, warning: AlertTriangle, recommendation: Sparkles };

  return (
    <div className={cn("rounded-2xl border border-primary/15 bg-primary/[0.02] overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary/10 bg-primary/[0.03]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><Sparkles className="h-4 w-4 text-primary" /></div>
          <div><p className="text-sm font-semibold text-foreground">AI Inventory Insights</p><p className="text-[11px] text-muted-foreground">{insights.length} recommendation(s)</p></div>
        </div>
        <button type="button" onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 1200); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="Refresh"><RefreshCcw className={cn("h-3.5 w-3.5", spinning && "animate-spin")} /> Refresh</button>
      </div>
      <div className="divide-y divide-border/50">
        {insights.slice(0, 6).map((ins) => {
          const s = SEV[ins.severity]; const Typ = TI[ins.type] || Sparkles;
          return (
            <div key={ins.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5", s.icon)}><s.El className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap"><span className="text-sm font-semibold text-foreground">{ins.title}</span><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.badge)}><Typ className="h-2.5 w-2.5" /> {ins.type}</span></div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.description}</p>
                  {ins.action && <p className="text-xs text-primary/80 font-medium mt-1.5">→ {ins.action}</p>}
                  {ins.metric && <span className="inline-flex mt-1.5 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground">{ins.metric}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
