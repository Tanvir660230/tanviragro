"use client";

import { Building2, TrendingUp, Beef, Package } from "lucide-react";

function fmtBdt(n: number) {
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

export function VendorStatCards({
  totalVendors,
  totalSpend,
  totalCattleSourced,
  totalInventorySuppliers,
}: {
  totalVendors: number;
  totalSpend: number;
  totalCattleSourced: number;
  totalInventorySuppliers: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Suppliers
          </p>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {totalVendors}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Active supply partners</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Spend
          </p>
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {fmtBdt(totalSpend)}
        </p>
        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          Procurement volume
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cattle Sourced
          </p>
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Beef className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {totalCattleSourced} heads
        </p>
        <p className="mt-1 text-xs text-muted-foreground">From cattle vendors</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Inventory Suppliers
          </p>
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Package className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {totalInventorySuppliers}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Feed &amp; medicine partners</p>
      </div>
    </div>
  );
}
