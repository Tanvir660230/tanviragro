"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import InventoryAIInsights from "@/components/inventory/InventoryAIInsights";
import {
  Wallet, AlertTriangle, Package, TrendingDown,
  ArrowRightLeft, FlaskConical, Receipt,
  BarChart3, ChevronRight, Zap, ArrowUpRight, Boxes, CheckCircle2,
} from "lucide-react";
import type { ItemStockSummary } from "@/lib/inventory/types";
import type { InventoryRow } from "@/components/inventory/InventoryTable";
import type { CattleOption } from "@/components/inventory/ItemActions";

type MoveRow = { item_id: string; type: string; qty: number; unit_cost: number | null; recorded_at: string; notes: string | null };

interface DashboardProps {
  portfolio: ItemStockSummary[];
  movements: MoveRow[];
  inventoryRows: InventoryRow[];
  cattle: CattleOption[];
}

const IN_TYPES = new Set(["purchase", "adjustment_in", "transfer_in", "return", "production_in"]);

export function InventoryDashboardClient({ portfolio, movements, inventoryRows, cattle }: DashboardProps) {
  const [quickActionExpanded, setQuickActionExpanded] = useState(true);

  const metrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const totalValue = portfolio.reduce((s, p) => s + p.totalValuation, 0);
    const outOfStock = portfolio.filter((p) => p.currentStock <= 0 && !p.isDiscontinued);
    const lowStock = portfolio.filter((p) => p.isLowStock && p.currentStock > 0 && !p.isDiscontinued);
    const healthyStock = portfolio.filter((p) => !p.isLowStock && p.currentStock > 0 && !p.isDiscontinued);
    const discontinuedCount = portfolio.filter((p) => p.isDiscontinued).length;

    // Today's consumption
    const todayConsumption = movements.filter((m) => {
      const t = new Date(m.recorded_at).getTime();
      return t >= todayStart && m.type === "consumption";
    }).reduce((s, m) => s + m.qty, 0);

    // 7-day movements
    const recentMovements = movements.filter((m) => new Date(m.recorded_at).getTime() >= sevenDaysAgo.getTime());
    const in7d = recentMovements.filter((m) => IN_TYPES.has(m.type)).reduce((s, m) => s + m.qty, 0);
    const out7d = recentMovements.filter((m) => !IN_TYPES.has(m.type)).reduce((s, m) => s + m.qty, 0);

    // Last 5 movements
    const last5 = movements.slice(0, 5);

    return { totalValue, outOfStock, lowStock, healthyStock, discontinuedCount, todayConsumption, in7d, out7d, last5 };
  }, [portfolio, movements]);

  const itemLookup = useMemo(() => new Map(portfolio.map((p) => [p.itemId, p])), [portfolio]);

  return (
    <div className="space-y-4">
      {/* ── KPI Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Inventory Value" value={`৳${Math.round(metrics.totalValue).toLocaleString("en-IN")}`} icon={Wallet} hint={`${portfolio.length} items tracked`} />
        <StatCard label="Out of Stock" value={metrics.outOfStock.length} icon={AlertTriangle} hint={metrics.outOfStock.length > 0 ? metrics.outOfStock.slice(0, 2).map((p) => p.itemName).join(", ") + (metrics.outOfStock.length > 2 ? ` +${metrics.outOfStock.length - 2}` : "") : "All items available"} className={metrics.outOfStock.length > 0 ? "border-rose-500/30" : undefined} />
        <StatCard label="Low Stock" value={metrics.lowStock.length} icon={Package} hint={metrics.lowStock.length > 0 ? "Items below reorder level" : "Stock levels healthy"} className={metrics.lowStock.length > 0 ? "border-amber-500/30" : undefined} />
        <StatCard label="Today's Consumption" value={metrics.todayConsumption.toLocaleString("en-IN", { maximumFractionDigits: 1 })} icon={TrendingDown} hint={`${metrics.in7d.toFixed(0)} in / ${metrics.out7d.toFixed(0)} out (7d)`} />
      </div>

      {/* ── Quick Actions + Alerts + AI Row ────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard title="Quick Actions" icon={Zap} iconVariant="amber" padding="tight">
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/dashboard/inventory/products", icon: Package, label: "Products", sub: "View all items", color: "bg-primary/10 text-primary" },
              { href: "/dashboard/inventory/purchase", icon: Receipt, label: "Purchase", sub: "Add purchase", color: "bg-amber-500/10 text-amber-600" },
              { href: "/dashboard/inventory/movements", icon: ArrowRightLeft, label: "Movements", sub: "Stock ledger", color: "bg-blue-500/10 text-blue-600" },
              { href: "/dashboard/inventory/mix-feed", icon: FlaskConical, label: "Feed Mixer", sub: "Mix rations", color: "bg-emerald-500/10 text-emerald-600" },
              { href: "/dashboard/inventory/warehouse", icon: Boxes, label: "Warehouse", sub: "Storage", color: "bg-purple-500/10 text-purple-600" },
              { href: "/dashboard/inventory/reports", icon: BarChart3, label: "Reports", sub: "Analytics", color: "bg-rose-500/10 text-rose-600" },
            ].map((q) => (
              <Link key={q.href} href={q.href} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-3 hover:bg-muted/50 hover:border-border transition-all group">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", q.color)}><q.icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors">{q.label}</p>
                  <p className="text-[10px] text-muted-foreground">{q.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Critical Alerts" icon={AlertTriangle} iconVariant="red" padding="tight">
          {metrics.outOfStock.length === 0 && metrics.lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 mb-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
              <p className="text-sm font-medium text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">No critical stock alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.outOfStock.slice(0, 3).map((p) => (
                <div key={p.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{p.itemName}</p>
                    <CategoryBadge category={p.category} />
                  </div>
                  <StatusBadge status="out_of_stock" />
                </div>
              ))}
              {metrics.lowStock.slice(0, 3).map((p) => (
                <div key={p.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{p.itemName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CategoryBadge category={p.category} />
                      <span className="text-[10px] text-muted-foreground font-mono">{p.currentStock.toFixed(1)} {p.unit}</span>
                    </div>
                  </div>
                  <StatusBadge status="low_stock" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <InventoryAIInsights items={inventoryRows} />
      </div>

      {/* ── Recent Movements ───────────────────────────────────── */}
      <SectionCard
        title="Recent Movements"
        description="Last 5 inventory transactions"
        icon={ArrowRightLeft}
        iconVariant="blue"
        padding="tight"
        action={
          <Link href="/dashboard/inventory/movements" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View All <ChevronRight className="h-3 w-3" />
          </Link>
        }
      >
        {metrics.last5.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No movements recorded yet.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {metrics.last5.map((m) => {
              const info = itemLookup.get(m.item_id);
              const isIn = IN_TYPES.has(m.type);
              return (
                <div key={m.item_id + m.recorded_at + m.qty} className="flex items-center justify-between gap-3 px-1 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                      {isIn ? <ArrowUpRight className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{info?.itemName ?? m.item_id}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{m.type.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("font-mono text-xs font-semibold", isIn ? "text-emerald-600" : "text-rose-600")}>
                      {isIn ? "+" : "−"}{m.qty.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {new Date(m.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Category Overview ──────────────────────────────────── */}
      <SectionCard title="Stock by Category" icon={BarChart3} iconVariant="primary" padding="tight">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {["feed", "roughage", "medicine", "equipment"].map((cat) => {
            const items = portfolio.filter((p) => p.category === cat && !p.isDiscontinued);
            const totalVal = items.reduce((s, p) => s + p.totalValuation, 0);
            const alerts = items.filter((p) => p.isLowStock || p.currentStock <= 0).length;
            const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
            return (
              <Link key={cat} href="/dashboard/inventory/products" className="rounded-xl border border-border/60 bg-card p-3 hover:border-primary/30 hover:bg-muted/30 transition-all group">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{catLabel}</p>
                <p className="text-lg font-bold font-mono tabular-nums mt-1">{items.length} <span className="text-xs text-muted-foreground font-normal">items</span></p>
                <p className="text-[11px] text-muted-foreground font-mono">৳{Math.round(totalVal).toLocaleString("en-IN")}</p>
                {alerts > 0 && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                    <AlertTriangle className="h-2.5 w-2.5" /> {alerts} alert{alerts > 1 ? "s" : ""}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}