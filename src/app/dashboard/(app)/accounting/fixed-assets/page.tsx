import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { AddFixedAssetDialog } from "@/components/accounting/AddFixedAssetDialog";
import { ArrowLeft, TrendingDown, Building2, Layers, DollarSign, Calendar, Archive } from "lucide-react";
import { StatementReportHeader } from "@/components/finance/finance-ui";

export const metadata: Metadata = { title: "Fixed Assets Register | Tanvir Agro Accounting" };

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  equipment: "Equipment",
  vehicle: "Vehicle",
  other: "Other",
};

const METHOD_LABELS: Record<string, string> = {
  straight_line: "Straight-line",
  declining_balance: "Declining Balance",
};

export default async function FixedAssetsPage() {
  const supabase = await createClient();
  const { fixedAssets, trialBalance: tb, asOf } = await getAccountingData(supabase);

  const active = fixedAssets.filter((a) => a.isActive);
  const disposed = fixedAssets.filter((a) => !a.isActive);

  const totalCost = active.reduce((s, a) => s + a.purchaseCost, 0);
  const totalAccumDep = active.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const totalBookValue = active.reduce((s, a) => s + a.bookValue, 0);
  const totalMonthlyDep = active.reduce((s, a) => s + a.monthlyDepreciation, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back link */}
      <div className="print:hidden">
        <Link
          href="/dashboard/accounting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Accounting Hub
        </Link>
      </div>

      {/* Header */}
      <StatementReportHeader
        title="Fixed Assets Register"
        subtitle="Capital Asset Schedules · Depreciation & Net Book Value"
        asOfDate={asOf}
        isAuditedBalanced={tb.isBalanced}
        action={<AddFixedAssetDialog />}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Gross Asset Cost</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(totalCost)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{active.length} active asset{active.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Accum. Depreciation</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">{fmt(totalAccumDep)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Lifetime write-down</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Net Book Value</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(totalBookValue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Current carrying balance</p>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.03] p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Monthly Run-Rate</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">{fmt(totalMonthlyDep)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Straight-line monthly dep.</p>
        </div>
      </div>

      {/* Active assets table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">Active Capital Assets</h2>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{active.length} total</span>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center mx-auto mb-3">
              <TrendingDown className="h-6 w-6" />
            </div>
            <p className="font-bold text-foreground">No fixed assets registered</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Add sheds, water pumps, generators, feed mixers, or vehicles to automatically calculate monthly depreciation schedules.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-3.5 px-5 text-left font-bold">Asset Name</th>
                    <th className="py-3.5 px-4 text-left font-bold">Category</th>
                    <th className="py-3.5 px-4 text-left font-bold">Method</th>
                    <th className="py-3.5 px-4 text-right font-bold">Gross Cost</th>
                    <th className="py-3.5 px-4 text-right font-bold w-36">Accum. Dep.</th>
                    <th className="py-3.5 px-4 text-right font-bold">Book Value</th>
                    <th className="py-3.5 px-5 text-right font-bold">Monthly Dep.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {active.map((asset) => {
                    const depPct = asset.purchaseCost > 0 ? (asset.accumulatedDepreciation / asset.purchaseCost) * 100 : 0;
                    return (
                      <tr key={asset.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-foreground">{asset.name}</p>
                          {asset.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{asset.description}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Purchased {new Date(asset.purchaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })} · {asset.usefulLifeYears}y useful life
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground">
                          <span className="rounded-full px-2 py-0.5 bg-muted/60 text-muted-foreground border border-border/40 font-semibold text-[11px]">
                            {CATEGORY_LABELS[asset.category] ?? asset.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground">
                          {METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm font-medium text-foreground">
                          {fmt(asset.purchaseCost)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono tabular-nums text-xs font-semibold text-amber-700 dark:text-amber-400">
                            {fmt(asset.accumulatedDepreciation)}
                          </span>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, depPct)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">{depPct.toFixed(0)}% written-off</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm font-bold text-foreground">
                          {fmt(asset.bookValue)}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono tabular-nums text-xs font-medium text-muted-foreground">
                          {fmt(asset.monthlyDepreciation)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/80 bg-muted/30 font-bold">
                    <td colSpan={3} className="py-3.5 px-5 text-xs text-foreground uppercase tracking-wider">
                      TOTAL ACTIVE ASSET POOL
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-foreground">
                      {fmt(totalCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-amber-700 dark:text-amber-400">
                      {fmt(totalAccumDep)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sm text-foreground font-bold">
                      {fmt(totalBookValue)}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums text-sm text-muted-foreground">
                      {fmt(totalMonthlyDep)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Disposed assets */}
      {disposed.length > 0 && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Disposed / Written-Off Assets</h2>
          </div>
          <div className="rounded-2xl bg-card border border-border/80 shadow-sm divide-y divide-border/40 overflow-hidden">
            {disposed.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between px-5 py-3.5 opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through text-foreground">{asset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Disposed {asset.disposedAt ? new Date(asset.disposedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
                    {asset.disposalValue != null ? ` · Recovered ${fmt(asset.disposalValue)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono tabular-nums font-semibold text-foreground">{fmt(asset.purchaseCost)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Original Cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
