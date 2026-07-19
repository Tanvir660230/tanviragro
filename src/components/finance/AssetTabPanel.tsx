import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { AssetRegister, type CostEntry } from "./CostList";

export type SimpleFixedAsset = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  purchaseDate: string;
  purchaseCost: number;
  bookValue: number;
  annualDepreciation: number;
  usefulLifeYears: number;
};

function fmt(n: number) {
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

const CATEGORY_STYLE: Record<string, string> = {
  infrastructure: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  equipment:      "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  vehicle:        "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400",
  land:           "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  other:          "bg-muted text-muted-foreground",
};

export function AssetTabPanel({
  costAssets,
  fixedAssets,
}: {
  costAssets: CostEntry[];
  fixedAssets: SimpleFixedAsset[];
}) {
  const hasAnything = costAssets.length > 0 || fixedAssets.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-xl border border-border/60 p-10 text-center space-y-3">
        <Building2 className="h-9 w-9 text-muted-foreground mx-auto" />
        <div>
          <p className="font-medium">কোনো সম্পদ নেই</p>
          <p className="text-sm text-muted-foreground mt-1">
            উপরের <strong>Add Cost / Asset</strong> বাটনে ক্লিক করে প্রথম সম্পদ যোগ করুন।
          </p>
        </div>
        <Link
          href="/dashboard/accounting/fixed-assets"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Depreciation tracking (Fixed Assets) <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  const totalCostEntryValue = costAssets.reduce((s, a) => s + Number(a.amount), 0);
  const totalFixedCost      = fixedAssets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalFixedBookValue = fixedAssets.reduce((s, a) => s + a.bookValue, 0);
  const totalAnnualDep      = fixedAssets.reduce((s, a) => s + a.annualDepreciation, 0);

  // Combined category totals (cost entries at cost; fixed assets at book value)
  const categoryTotals: Record<string, number> = {};
  for (const a of costAssets) {
    const k = a.category.toLowerCase();
    categoryTotals[k] = (categoryTotals[k] ?? 0) + Number(a.amount);
  }
  for (const a of fixedAssets) {
    const k = a.category.toLowerCase();
    categoryTotals[k] = (categoryTotals[k] ?? 0) + a.bookValue;
  }
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Capital Entries",
            value: fmt(totalCostEntryValue),
            sub: `${costAssets.length} item${costAssets.length !== 1 ? "s" : ""}`,
            ring: "ring-amber-500/10", grad: "from-amber-500/[0.05]",
            text: "text-amber-700 dark:text-amber-400",
          },
          {
            label: "Fixed Assets (Cost)",
            value: fmt(totalFixedCost),
            sub: `${fixedAssets.length} asset${fixedAssets.length !== 1 ? "s" : ""}`,
            ring: "ring-blue-500/10", grad: "from-blue-500/[0.05]",
            text: "text-blue-700 dark:text-blue-400",
          },
          {
            label: "Fixed Book Value",
            value: fmt(totalFixedBookValue),
            sub: "After depreciation",
            ring: "ring-purple-500/10", grad: "from-purple-500/[0.05]",
            text: "text-purple-700 dark:text-purple-400",
          },
          {
            label: "Annual Dep.",
            value: fmt(totalAnnualDep),
            sub: "Fixed assets only",
            ring: "ring-rose-500/10", grad: "from-rose-500/[0.05]",
            text: "text-rose-600 dark:text-rose-400",
          },
        ].map(({ label, value, sub, ring, grad, text }) => (
          <div key={label} className={`relative overflow-hidden rounded-xl bg-card ring-1 ${ring} px-4 py-3 shadow-card`}>
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grad} to-transparent`} />
            <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`relative mt-1 text-lg font-bold tabular-nums ${text}`}>{value}</p>
            <p className="relative text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Category breakdown ────────────────────────────────────── */}
      {sortedCats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedCats.map(([cat, total]) => (
            <span
              key={cat}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize ${CATEGORY_STYLE[cat] ?? CATEGORY_STYLE.other}`}
            >
              {cat}
              <span className="font-bold">{fmt(total)}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Capital Entries (cost_entries) ────────────────────────── */}
      {costAssets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
            Capital Entries
          </p>
          <AssetRegister assets={costAssets} />
        </div>
      )}

      {/* ── Fixed Assets (fixed_assets table) ────────────────────── */}
      {fixedAssets.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fixed Assets
            </p>
            <Link
              href="/dashboard/accounting/fixed-assets"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Full depreciation schedule <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.04] to-transparent overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-blue-200 dark:border-blue-800/60 bg-blue-100/40 dark:bg-blue-950/20">
                    <th className="px-4 py-2.5 text-left font-medium text-blue-700 dark:text-blue-400">Asset</th>
                    <th className="px-4 py-2.5 text-left font-medium text-blue-700 dark:text-blue-400 hidden sm:table-cell">Category</th>
                    <th className="px-4 py-2.5 text-right font-medium text-blue-700 dark:text-blue-400">Cost</th>
                    <th className="px-4 py-2.5 text-right font-medium text-blue-700 dark:text-blue-400">Book Value</th>
                    <th className="px-4 py-2.5 text-right font-medium text-blue-700 dark:text-blue-400 hidden md:table-cell">Annual Dep.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 dark:divide-blue-900/40">
                  {fixedAssets.map((a) => (
                    <tr key={a.id} className="hover:bg-blue-50/60 dark:hover:bg-blue-950/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.name}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Since {new Date(a.purchaseDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                          {" · "}{a.usefulLifeYears}yr life
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground hidden sm:table-cell">{a.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(a.purchaseCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-300">
                        {fmt(a.bookValue)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {fmt(a.annualDepreciation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Summary footer */}
            <div className="border-t-2 border-blue-200 dark:border-blue-800/60 bg-blue-100/40 dark:bg-blue-950/20 px-4 py-2.5 flex items-center justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total ({fixedAssets.length})</span>
              <div className="flex items-center gap-5 tabular-nums">
                <span className="text-muted-foreground hidden md:inline">
                  {fmt(totalAnnualDep)}/yr dep
                </span>
                <span className="text-blue-700 dark:text-blue-300">{fmt(totalFixedBookValue)} book</span>
                <span>{fmt(totalFixedCost)} cost</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-blue-300 dark:border-blue-800 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Depreciation tracking</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add fixed assets (shed, pump, vehicle) to auto-calculate annual depreciation.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/fixed-assets"
            className="text-xs font-medium text-primary whitespace-nowrap inline-flex items-center gap-1 hover:underline shrink-0"
          >
            Fixed Assets <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
