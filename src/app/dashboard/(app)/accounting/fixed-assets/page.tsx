import { PageHeader } from "@/components/shared/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { buttonVariants } from "@/components/ui/button";
import { AddFixedAssetDialog } from "@/components/accounting/AddFixedAssetDialog";
import { ArrowLeft, TrendingDown } from "lucide-react";

export const metadata: Metadata = { title: "Fixed Assets" };

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
  const { fixedAssets, asOf } = await getAccountingData(supabase);

  const active = fixedAssets.filter((a) => a.isActive);
  const disposed = fixedAssets.filter((a) => !a.isActive);

  const totalCost = active.reduce((s, a) => s + a.purchaseCost, 0);
  const totalAccumDep = active.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const totalBookValue = active.reduce((s, a) => s + a.bookValue, 0);
  const totalMonthlyDep = active.reduce((s, a) => s + a.monthlyDepreciation, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fixed Assets"
        subtitle={`As of ${new Date(asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        back="/dashboard/accounting"
        actions={<AddFixedAssetDialog />}
      />

      {/* Summary cards */}
      {active.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Gross Cost", value: fmt(totalCost), sub: `${active.length} asset${active.length !== 1 ? "s" : ""}` },
            { label: "Accum. Depreciation", value: fmt(totalAccumDep), sub: "Lifetime" },
            { label: "Net Book Value", value: fmt(totalBookValue), sub: "Current" },
            { label: "Monthly Dep.", value: fmt(totalMonthlyDep), sub: "All active assets" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-card border border-border/60 shadow-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active assets table */}
      {active.length === 0 ? (
        <div className="rounded-xl bg-card border border-border/60 shadow-card p-10 text-center">
          <TrendingDown className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No fixed assets recorded</p>
          <p className="text-sm text-muted-foreground mt-1">Add sheds, fans, water pumps, or vehicles to track depreciation.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 px-4 text-left font-semibold">Asset</th>
                <th className="py-3 px-4 text-left font-semibold">Category</th>
                <th className="py-3 px-4 text-left font-semibold">Method</th>
                <th className="py-3 px-4 text-right font-semibold">Cost</th>
                <th className="py-3 px-4 text-right font-semibold">Accum. Dep.</th>
                <th className="py-3 px-4 text-right font-semibold">Book Value</th>
                <th className="py-3 px-4 text-right font-semibold">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {active.map((asset) => {
                const depPct = asset.purchaseCost > 0
                  ? (asset.accumulatedDepreciation / asset.purchaseCost) * 100
                  : 0;
                return (
                  <tr key={asset.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <p className="font-medium">{asset.name}</p>
                      {asset.description && (
                        <p className="text-xs text-muted-foreground">{asset.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Since {new Date(asset.purchaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })} · {asset.usefulLifeYears}yr life
                      </p>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {CATEGORY_LABELS[asset.category] ?? asset.category}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{fmt(asset.purchaseCost)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {fmt(asset.accumulatedDepreciation)}
                      <div className="w-full bg-muted rounded-full h-1 mt-1">
                        <div
                          className="bg-amber-500 h-1 rounded-full"
                          style={{ width: `${Math.min(100, depPct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold">{fmt(asset.bookValue)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                      {fmt(asset.monthlyDepreciation)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/20 font-semibold bg-muted/20">
                <td colSpan={3} className="py-3 px-4">TOTALS</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totalCost)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmt(totalAccumDep)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totalBookValue)}</td>
                <td className="py-3 px-4 text-right tabular-nums">{fmt(totalMonthlyDep)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Disposed assets */}
      {disposed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Disposed Assets</h2>
          <div className="rounded-xl bg-card border border-border/60 shadow-card divide-y divide-border/50">
            {disposed.map((asset) => (
              <div key={asset.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Disposed {asset.disposedAt ? new Date(asset.disposedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
                    {asset.disposalValue != null ? ` · Recovered ${fmt(asset.disposalValue)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{fmt(asset.purchaseCost)}</p>
                  <p className="text-xs text-muted-foreground">original cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
