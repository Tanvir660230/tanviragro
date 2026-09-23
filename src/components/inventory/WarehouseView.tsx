"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard, ProgressCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import {
  Warehouse, Building2, ShieldCheck, ArrowRightLeft, Layers, Package, Wheat, Pill, Wrench,
} from "lucide-react";
import type { WarehouseLocation } from "@/lib/inventory/warehouse-engine";
import type { ItemStockSummary } from "@/lib/inventory/types";

type MoveRow = { item_id: string; type: string; qty: number; recorded_at: string; notes: string | null };

export function WarehouseView({
  warehouses, portfolio, movements,
}: {
  warehouses: WarehouseLocation[];
  portfolio: ItemStockSummary[];
  movements: MoveRow[];
}) {
  const [selected, setSelected] = useState(warehouses[0]?.id ?? "");
  const active = warehouses.find((w) => w.id === selected) ?? warehouses[0];

  const totalItems = portfolio.length;
  const totalStock = portfolio.reduce((s, p) => s + p.currentStock, 0);
  const totalValue = portfolio.reduce((s, p) => s + p.totalValuation, 0);
  const outOfStock = portfolio.filter((p) => p.currentStock <= 0).length;

  const recent = useMemo(() => {
    return [...movements].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()).slice(0, 8);
  }, [movements]);

  const itemNameLookup: Record<string, string> = {};
  for (const p of portfolio) itemNameLookup[p.itemId] = p.itemName;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Warehouses" value={warehouses.length} icon={Warehouse} hint="active locations" />
        <StatCard label="Products Tracked" value={totalItems} icon={Layers} hint="across all warehouses" />
        <StatCard label="Stock Value" value={`৳${Math.round(totalValue).toLocaleString("en-IN")}`} icon={ShieldCheck} />
        <StatCard label="Items Depleted" value={outOfStock} icon={Package} hint={outOfStock > 0 ? "needs restocking" : "all stocked"} />
      </div>

      {/* Warehouse list + detail */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Warehouse selector */}
        <div className="space-y-2">
          {warehouses.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelected(w.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all",
                selected === w.id
                  ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                  : "border-border/70 hover:bg-muted/40"
              )}
              aria-pressed={selected === w.id}
            >
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                selected === w.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{w.name}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{w.code}</span>
                  <span>·</span>
                  <span className="capitalize">{w.type.replace(/_/g, " ")}</span>
                </div>
              </div>
              {w.isDefault && <StatusBadge status="active" label="Default" />}
            </button>
          ))}
        </div>

        {/* Selected warehouse detail */}
        <div className="space-y-4">
          <SectionCard
            title={active?.name ?? "Warehouse"}
            description={`${active?.code ?? ""} · ${active?.type?.replace(/_/g, " ") ?? ""} zone`}
            icon={Building2}
            iconVariant={active?.isDefault ? "emerald" : "primary"}
            action={active?.isDefault ? <StatusBadge status="active" label="Primary" /> : <StatusBadge status="pending" label="Secondary" />}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Location Type</p>
                <p className="text-sm font-semibold capitalize">{active?.type.replace(/_/g, " ")}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Capacity (KG)</p>
                <p className="text-sm font-semibold font-mono">{active?.capacityKg?.toLocaleString("en-IN") ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Zone</p>
                <p className="text-sm font-semibold capitalize">{active?.type.split("_")[0]}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                <p className="text-sm font-semibold text-emerald-600">Operational</p>
              </div>
            </div>
          </SectionCard>

          <ProgressCard label="Stock Value Utilization" value={totalItems > 0 ? 100 : 0} max={100} unit="% of catalog" icon={Layers} />

          {/* Category breakdown */}
          <SectionCard title="Catalog by Category" icon={Layers} iconVariant="primary" padding="tight">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {["feed", "medicine", "equipment", "roughage"].map((cat) => {
                const items = portfolio.filter((p) => p.category === cat);
                const value = items.reduce((s, p) => s + p.totalValuation, 0);
                const Ico = cat === "feed" ? Wheat : cat === "medicine" ? Pill : cat === "equipment" ? Wrench : Layers;
                return (
                  <div key={cat} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Ico className="h-3.5 w-3.5" /></div>
                      <span className="text-xs font-semibold capitalize">{cat}</span>
                    </div>
                    <p className="text-lg font-bold font-mono tabular-nums">{items.length}</p>
                    <p className="text-[11px] text-muted-foreground">৳{Math.round(value).toLocaleString("en-IN")}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Recent movements */}
          <SectionCard title="Recent Movements (this location)" icon={ArrowRightLeft} iconVariant="blue" padding="tight">
            {recent.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No recent movements.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {recent.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{itemNameLookup[m.item_id] ?? m.item_id}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{m.notes || m.type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <CategoryBadge category={itemNameLookup[m.item_id] ? "other" : "other"} />
                      <p className={cn("text-sm font-mono font-semibold",
                        ["purchase", "adjustment_in", "transfer_in", "return"].includes(m.type)
                          ? "text-emerald-600" : "text-rose-600")}>
                        {["purchase", "adjustment_in", "transfer_in", "return"].includes(m.type) ? "+" : "−"}{m.qty}{m.type.includes("purchase") ? "" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
