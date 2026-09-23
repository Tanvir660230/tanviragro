"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import {
  Wallet, TrendingDown, AlertTriangle, Package, ShoppingCart, ArrowRightLeft,
  BarChart3, Wheat, Pill, Wrench, Layers, FileSpreadsheet,
} from "lucide-react";
import type { ItemStockSummary } from "@/lib/inventory/types";

type MoveRow = { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string; notes: string | null };

const IN_TYPES = new Set(["purchase", "adjustment_in", "transfer_in", "return", "production_in"]);
const OUT_TYPES = new Set(["consumption", "adjustment_out", "transfer_out", "waste", "production_out"]);

function daysAgoDays() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 86400000);
  return { now, start };
}

export function ReportsClient({ portfolio, movements }: { portfolio: ItemStockSummary[]; movements: MoveRow[] }) {
  const { now, start } = daysAgoDays();

  const totalValue = portfolio.reduce((s, p) => s + p.totalValuation, 0);
  const lowStock = portfolio.filter((p) => p.isLowStock);
  const outOfStock = portfolio.filter((p) => p.currentStock <= 0);
  const avgCost = portfolio.filter((p) => p.averageUnitCost != null).reduce((s, p) => s + (p.averageUnitCost || 0), 0)
    / Math.max(1, portfolio.filter((p) => p.averageUnitCost != null).length);
const consumption30d = useMemo(() => {
    const filtered = movements.filter((m) => {
      const t = new Date(m.recorded_at).getTime();
      return t >= start.getTime() && t <= now.getTime() && m.type === "consumption";
    });
    return filtered.reduce((s, m) => s + m.qty, 0);
  }, [movements, start, now]);

  const purchase30d = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const filtered = movements.filter((m) => {
      const t = new Date(m.recorded_at).getTime();
      return t >= start.getTime() && t <= now.getTime() && m.type === "purchase";
    });
    return filtered.reduce((s, m) => s + m.qty, 0);
  }, [movements, start, now]);

  const waste30d = useMemo(() => {
    const filtered = movements.filter((m) => {
      const t = new Date(m.recorded_at).getTime();
      return t >= start.getTime() && t <= now.getTime() && (m.type === "waste" || m.type === "adjustment_out");
    });
    return filtered.reduce((s, m) => s + m.qty, 0);
  }, [movements, start, now]);

  const topConsumed = useMemo(() => {
    const map = new Map<string, { name: string; category: string; qty: number; unit: string; value: number }>();
    const itemLookup = new Map(portfolio.map((p) => [p.itemId, p]));
    const filtered = movements.filter((m) => {
      const t = new Date(m.recorded_at).getTime();
      return t >= start.getTime() && t <= now.getTime();
    });
    for (const m of filtered) {
      const info = itemLookup.get(m.item_id);
      const name = info?.itemName ?? m.item_id;
      const category = info?.category ?? "other";
      const unit = info?.unit ?? "";
      const cur = map.get(m.item_id) ?? { name, category, qty: 0, unit, value: 0 };
      if (m.type === "consumption") cur.qty += m.qty;
      if ((m.type === "purchase" || m.type === "adjustment_in") && m.unit_cost != null) cur.value += m.qty * m.unit_cost;
      map.set(m.item_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [movements, portfolio, start, now]);

  const reorderNeeds = useMemo(() => {
    return portfolio
      .filter((p) => p.isLowStock || p.currentStock <= 0)
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 10);
  }, [portfolio]);

  const movementBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of movements) counts.set(m.type, (counts.get(m.type) ?? 0) + m.qty);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [movements]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Inventory Value" value={`৳${Math.round(totalValue).toLocaleString("en-IN")}`} icon={Wallet} hint="current stock valuation" />
        <StatCard label="30-Day Consumption" value={consumption30d.toLocaleString("en-IN", { maximumFractionDigits: 0 })} icon={TrendingDown} hint="units consumed" />
        <StatCard label="30-Day Purchases" value={purchase30d.toLocaleString("en-IN", { maximumFractionDigits: 0 })} icon={ShoppingCart} hint="units received" />
        <StatCard label="Stock Alerts" value={lowStock.length + outOfStock.length} icon={AlertTriangle} hint={`${outOfStock.length} out · ${lowStock.length} low`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Top Consumed (30 days)" icon={BarChart3} iconVariant="primary" padding="tight">
          {topConsumed.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No consumption logged in the last 30 days.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {topConsumed.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/80 text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <CategoryBadge category={c.category} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold text-sm">{c.qty.toLocaleString("en-IN", { maximumFractionDigits: 1 })} <span className="text-xs text-muted-foreground">{c.unit}</span></p>
                    <p className="text-[11px] text-muted-foreground font-mono">৳{Math.round(c.value).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Movement Summary by Type" icon={ArrowRightLeft} iconVariant="blue" padding="tight">
          {movementBreakdown.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No movements recorded.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {movementBreakdown.map(([type, qty]) => {
                const isIn = IN_TYPES.has(type);
                return (
                  <div key={type} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-sm font-medium capitalize text-foreground">{type.replace(/_/g, " ")}</span>
                    <span className={cn("font-mono font-semibold text-sm", isIn ? "text-emerald-600" : "text-rose-600")}>
                      {isIn ? "+" : "−"}{qty.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Reorder Planning" description="Items at or below threshold requiring replenishment" icon={ShoppingCart} iconVariant="amber" padding="tight">
          {reorderNeeds.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">All stock levels are healthy — no reorder needed.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {reorderNeeds.map((p, i) => (
                <div key={p.itemId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.itemName}</p>
                    <CategoryBadge category={p.category} />
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      {p.currentStock <= 0 ? <StatusBadge status="out_of_stock" /> : <StatusBadge status="low_stock" />}
                      <span className="font-mono font-semibold text-sm">{p.currentStock.toFixed(1)} {p.unit}</span>
                    </div>
                    {p.lowStockThreshold != null && (
                      <p className="text-[11px] text-muted-foreground">Threshold: {p.lowStockThreshold}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Category Snapshot" icon={Layers} iconVariant="purple" padding="tight">
          <div className="grid grid-cols-2 gap-2.5">
            {["feed", "roughage", "medicine", "equipment"].map((cat) => {
              const items = portfolio.filter((p) => p.category === cat);
              const value = items.reduce((s, p) => s + p.totalValuation, 0);
              const Ico = cat === "feed" ? Wheat : cat === "medicine" ? Pill : cat === "equipment" ? Wrench : Layers;
              const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
              return (
                <div key={cat} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Ico className="h-3.5 w-3.5" /></div>
                    <span className="text-xs font-semibold capitalize">{cat}</span>
                  </div>
                  <p className="text-lg font-bold font-mono tabular-nums">{items.length}</p>
                  <p className="text-[11px] text-muted-foreground">৳{Math.round(value).toLocaleString("en-IN")} · {pct.toFixed(0)}%</p>
                  <div className="h-1.5 w-full rounded-full bg-muted mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="text-xs text-muted-foreground border border-border/60 rounded-xl bg-muted/20 px-4 py-3">
        <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1.5" />
        Report period: last 30 days. Valuation uses FIFO costing for purchased items; items without purchase costs are valued at ৳0.
      </div>
    </div>
  );
}