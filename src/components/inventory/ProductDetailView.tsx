"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/shared/SectionCard";
import { Timeline } from "@/components/ui/timeline";
import { StatusBadge } from "@/components/ui/status-badge";
import { CategoryBadge } from "@/components/inventory/inventory-ui";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Boxes,
  TrendingUp,
  Clock,
  Package,
  Layers,
  ShoppingCart,
  DollarSign,
} from "lucide-react";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import type { RawInventoryItemRow } from "@/lib/inventory/stock-ledger";
import type { ItemStockSummary, StockLedgerEntry, StockValuationBreakdown } from "@/lib/inventory/types";
import { useL } from "@/i18n/text";
import { costCategoryLabel } from "@/lib/expenses/labels";
import { useTranslation } from "@/i18n/I18nProvider";

type PurchaseRow = { id: string; qty: number; unit_cost: number | null; recorded_at: string; notes: string | null };
type SimpleItem = { id: string; name: string; unit: string; category: string; stock: number };

export function ProductDetailView({
  item, summary, ledger, valuation, purchases, allItems,
}: {
  item: RawInventoryItemRow;
  summary: ItemStockSummary | null;
  ledger: StockLedgerEntry[];
  valuation: StockValuationBreakdown | null;
  purchases: PurchaseRow[];
  allItems: SimpleItem[];
}) {
  const L = useL();
  const { locale } = useTranslation();
  const stock = summary?.currentStock ?? 0;
  const unit = item.unit;
  const isOut = stock <= 0;
  const isLow = !isOut && item.low_stock_threshold !== null && stock <= item.low_stock_threshold;

  const avgDaily = useMemo(() => {
    if (ledger.length < 2) return null;
    const now = new Date();
    const recent = ledger.filter((l) => now.getTime() - new Date(l.recordedAt).getTime() < 30 * 86400000 && l.direction === "OUT");
    const total = recent.reduce((s, l) => s + l.quantity, 0);
    return total / 30;
  }, [ledger]);

  const totalIn = ledger.filter((l) => l.direction === "IN").reduce((s, l) => s + l.quantity, 0);
  const totalOut = ledger.filter((l) => l.direction === "OUT").reduce((s, l) => s + l.quantity, 0);
  const totalCost = purchases.reduce((s, p) => s + p.qty * (p.unit_cost || 0), 0);
  const lastPurchase = purchases.length > 0 ? purchases[purchases.length - 1] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CategoryBadge category={item.category} />
          {isOut ? <StatusBadge status="out_of_stock" /> : isLow ? <StatusBadge status="low_stock" /> : <StatusBadge status="in_stock" />}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTab value="overview">{L("সারসংক্ষেপ", "Overview")}</TabsTab>
          <TabsTab value="history">{L("লেনদেন", "Stock history")}</TabsTab>
          <TabsTab value="valuation">{L("মূল্য", "Valuation")}</TabsTab>
          <TabsTab value="purchases">{L("কেনা", "Purchases")}</TabsTab>
        </TabsList>

        <TabsPanel value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={L("স্টকে আছে", "Stock On Hand")} value={`${stock.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}`} icon={Boxes} />
            <StatCard label={L("গড় দাম/একক", "Average Unit Cost")} value={valuation?.unitCost ? `৳${valuation.unitCost.toFixed(2)}` : "—"} icon={Wallet} />
            <StatCard label={L("মোট মূল্য", "Total Valuation")} value={valuation?.totalValue ? `৳${valuation.totalValue.toLocaleString("en-IN")}` : "—"} icon={DollarSign} />
            <StatCard label={L("গড় দৈনিক খরচ", "Avg Daily Use")} value={avgDaily != null ? `${avgDaily.toFixed(2)} ${unit}` : "—"} icon={TrendingUp} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <SectionCard title={L("স্টকের হিসাব", "Stock Summary")} icon={Layers} iconVariant="primary">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SearchInfo label={L("মোট এসেছে", "Total In")} value={`${totalIn.toFixed(2)} ${unit}`} />
                <SearchInfo label={L("মোট গেছে", "Total Out")} value={`${totalOut.toFixed(2)} ${unit}`} />
                <SearchInfo label={L("কম হলে সতর্কতা", "Reorder Level")} value={item.low_stock_threshold != null ? `${item.low_stock_threshold} ${unit}` : L("দেওয়া নেই", "Not set")} />
                <SearchInfo label={L("ধরন", "Category")} value={costCategoryLabel(item.category, locale)} />
              </div>
              <div className="mt-4">
                <StockHealthBar stock={stock} threshold={item.low_stock_threshold} />
              </div>
            </SectionCard>

            <SectionCard title={L("দ্রুত কাজ", "Quick Actions")} icon={ShoppingCart} iconVariant="emerald" action={<StockAdjustmentDialog itemId={item.id} itemName={item.name} currentStock={stock} unit={unit} />}>
              <AddItemDialog />
            </SectionCard>
          </div>
        </TabsPanel>

        <TabsPanel value="history">
          <SectionCard title={L("লেনদেনের সময়রেখা", "Movement Timeline")} icon={Clock} iconVariant="primary" padding="none">
            {ledger.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground"><Package className="mx-auto h-8 w-8 opacity-30 mb-2" /><p>{L("এখনো কোনো লেনদেন নেই।", "No movements recorded yet.")}</p></div>
            ) : (
              <Timeline
                items={[...ledger].reverse().map((entry) => ({
                  title: `${L(MOVE_BN[entry.type] ?? entry.type.replace(/_/g, " "), entry.type.replace(/_/g, " "))} — ${entry.direction === "IN" ? "+" : "−"}${entry.quantity} ${unit}`,
                  description: [
                    entry.notes || null,
                    entry.unitCost != null ? `@ ৳${entry.unitCost.toFixed(2)}` : null,
                    L(`বাকি: ${entry.runningBalance} ${unit}`, `Bal: ${entry.runningBalance} ${unit}`),
                  ].filter(Boolean).join(" · ") || "—",
                  timestamp: entry.recordedAt.slice(0, 10),
                  icon: entry.direction === "IN" ? ArrowDownLeft : ArrowUpRight,
                  tone: entry.direction === "IN" ? "success" : "destructive",
                }))}
              />
            )}
          </SectionCard>
        </TabsPanel>

        <TabsPanel value="valuation">
          <SectionCard title={L("স্টকের মূল্য (গড় দামে)", "Stock Valuation (average cost)")} icon={Wallet} iconVariant="amber" padding="none">
            {valuation && valuation.activeBatches.length > 0 ? (
              <div className="divide-y divide-border/50">
                <div className="px-5 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{L("মূল্য ধরার পদ্ধতি", "Valuation Method")}</span>
                  <span className="font-semibold">{valuation.valuationMethod}</span>
                </div>
                <div className="px-5 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{L("স্টকে আছে", "Stock On Hand")}</span>
                  <span className="font-semibold font-mono">{valuation.stockOnHand} {unit}</span>
                </div>
                <div className="px-5 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{L("দাম/একক (গড়)", "Unit Cost (blended)")}</span>
                  <span className="font-semibold font-mono">৳{valuation.unitCost.toFixed(2)}</span>
                </div>
                <div className="px-5 py-3 flex justify-between text-sm bg-muted/20">
                  <span className="font-semibold">{L("মোট মূল্য", "Total Value")}</span>
                  <span className="font-semibold font-mono text-primary">৳{valuation.totalValue.toLocaleString("en-IN")}</span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground"><p>{L("স্টকে কিছু নেই।", "No active stock to value yet.")}</p></div>
            )}
            {valuation && valuation.activeBatches.length > 0 && (
              <div className="border-t border-border/60 px-5 py-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{L("স্টকের ব্যাচ", "Active Batches")}</p>
                {valuation.activeBatches.map((b) => (
                  <div key={b.batchId} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground">{b.purchaseDate}</span>
                    <span className="font-mono font-semibold">{b.remainingQty} {unit}</span>
                    <span className="font-mono text-muted-foreground">@ ৳{(b.unitCost || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsPanel>

        <TabsPanel value="purchases">
          <SectionCard title={L("কেনার ইতিহাস", "Purchase History")} icon={ShoppingCart} iconVariant="emerald" padding="none">
            {purchases.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><p>{L("কোনো কেনা নেই।", "No purchases recorded.")}</p></div>
            ) : (
              <div className="divide-y divide-border/50">
                {[...purchases].reverse().map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.recorded_at.slice(0, 10)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.notes || "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold">{p.qty} {unit}</p>
                      {p.unit_cost != null && <p className="text-[11px] text-muted-foreground font-mono">৳{p.unit_cost.toFixed(2)}/unit</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsPanel>
      </Tabs>
    </div>
  );
}

const MOVE_BN: Record<string, string> = {
  purchase: "কেনা", consumption: "খাওয়ানো", adjustment_in: "গণনা +", adjustment_out: "গণনা −", waste: "নষ্ট", return: "ফেরত",
  transfer_in: "স্থানান্তর আসা", transfer_out: "স্থানান্তর যাওয়া", production_in: "মিক্স তৈরি", production_out: "মিক্সে গেছে",
};

function SearchInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}

function StockHealthBar({ stock, threshold }: { stock: number; threshold: number | null }) {
  const L = useL();
  const isOut = stock <= 0;
  const isLow = !isOut && threshold !== null && stock <= threshold;
  const pct = threshold && threshold > 0 ? Math.min(100, Math.max(8, (stock / (threshold * 2)) * 100)) : 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">{isOut ? L("শেষ", "Depleted") : isLow ? L("কম আছে", "Low stock") : L("যথেষ্ট আছে", "Enough")}</span>
        <span className="text-muted-foreground">{threshold != null ? L(`${threshold}-এ নামলে সতর্কতা`, `Alert at ${threshold}`) : L("সীমা দেওয়া নেই", "No threshold")}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", isOut ? "w-0 bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500")} style={{ width: isOut ? "0%" : `${pct}%` }} />
      </div>
    </div>
  );
}
