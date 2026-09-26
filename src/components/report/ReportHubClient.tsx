"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Building2,
  Activity,
  CheckCircle2,
  Calculator,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { ZakatCalculator } from "@/components/finance/ZakatCalculator";
import { cn } from "@/lib/utils";
import { SitePageTitle } from "@/components/navigation/SitePageTitle";


import { useL } from "@/i18n/text";
import { todayDhaka } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
export interface InventoryItemStock {
  name: string;
  category: string;
  unit: string;
  stock: number;
  avgCost: number;
  value: number;
}

export interface ReportHubData {
  bizName: string;
  reportDate: string;
  reportId: string;
  totalCattle: number;
  activeCattle: number;
  soldCattle: number;
  activeCattleValuation: number;
  revenue: number;
  soldCattleCost: number;
  feedCost: number;
  operatingCosts: number;
  netPL: number;
  cashBalance: number;
  bankBalance: number;
  totalLiquidCash: number;
  totalInventoryValue: number;
  inventoryWithStock: InventoryItemStock[];
  totalLiabilities: number;
  netEquity: number;
  zakatAssets: number;
  analyticsPayload?: any;
}

function fmt(n: number) {
  return "৳" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(n));
}

export function ReportHubClient(props: (ReportHubData & { analyticsPayload?: any }) | { data: ReportHubData & { analyticsPayload?: any } }) {
  const L = useL();
  const data = "data" in props && (props as { data: ReportHubData }).data ? (props as { data: ReportHubData }).data : (props as ReportHubData & { analyticsPayload?: any });
  const [activeTab, setActiveTab] = useState<"summary" | "zakat">("summary");

  const {
    bizName, reportDate, reportId, totalCattle, activeCattle, soldCattle,
    activeCattleValuation, revenue, soldCattleCost, feedCost, operatingCosts,
    netPL, cashBalance, bankBalance, totalLiquidCash, totalInventoryValue,
    inventoryWithStock, totalLiabilities, netEquity, zakatAssets,
  } = data;

  function exportSummaryCSV() {
    const csvRows = [
      ["Report Title", `"${bizName} Farm Executive Report"`],
      ["Report Reference", reportId],
      ["Generated Date", reportDate],
      [],
      ["HERD & LIVESTOCK ASSETS", "Value / Count"],
      ["Total Cattle Head Count", totalCattle],
      ["Active Cattle in Herd", activeCattle],
      ["Sold Cattle (Lifetime)", soldCattle],
      ["Active Livestock Valuation (BDT)", activeCattleValuation],
      [],
      ["FINANCIAL PERFORMANCE (REALIZED P&L)", "Amount (BDT)"],
      ["Cattle Sales Revenue", revenue],
      ["Cost of Cattle Sold", soldCattleCost],
      ["Total Feed & Inventory Consumed", feedCost],
      ["Operating & Medical Expenses", operatingCosts],
      ["Net Realized Profit / (Loss)", netPL],
      [],
      ["BALANCE SHEET & ASSET VALUATION", "Amount (BDT)"],
      ["Liquid Cash Balance (Hand)", cashBalance],
      ["Bank Account Balance", bankBalance],
      ["Total Liquid Funds", totalLiquidCash],
      ["Livestock Asset Value", activeCattleValuation],
      ["Feed & Supplies Inventory Value", totalInventoryValue],
      ["Total Combined Assets", totalLiquidCash + activeCattleValuation + totalInventoryValue],
      ["Outstanding Liabilities & Loans", totalLiabilities],
      ["Net Farm Equity", netEquity],
      [],
      ["FEED & SUPPLIES INVENTORY BREAKDOWN"],
      ["Item Name", "Category", "In Stock", "Unit", "Avg Unit Cost (BDT)", "Total Valuation (BDT)"],
      ...inventoryWithStock.map((item) => [
        item.name,
        item.category,
        item.stock,
        item.unit,
        Math.round(item.avgCost),
        Math.round(item.value),
      ]),
    ];

    downloadCsv(`farm_report_${bizName.toLowerCase().replace(/\s+/g, "_")}_${todayDhaka()}.csv`, csvRows);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ── Screen Navigation & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                <SitePageTitle fallback="Reports" />
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {bizName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={exportSummaryCSV}
            className="rounded-xl border-border/80 gap-1.5 text-xs font-medium cursor-pointer hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            {L("CSV নামান", "Export CSV")}
          </Button>
          <PrintButton label={L("প্রিন্ট করুন", "Print report")} />
        </div>
      </div>

      {/* ── Interactive View Switcher (Screen Only) ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 print:hidden">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60">
          <button
            onClick={() => setActiveTab("summary")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "summary"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            {L("খামারের হিসাব বিবরণী", "Farm Financial Statement")}
          </button>
          <button
            onClick={() => setActiveTab("zakat")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "zakat"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calculator className="h-3.5 w-3.5" />
            {L("যাকাত হিসাব", "Zakat Estimator")}
          </button>
        </div>

        <div className="text-xs text-muted-foreground hidden md:flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {L("তারিখ", "Report date")}: <span className="font-semibold text-foreground">{reportDate}</span>
        </div>
      </div>

      {/* ── Zakat Tab ── */}
      {activeTab === "zakat" && (
        <div className="space-y-4 print:hidden animate-fade-in">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                {L("যাকাতের হিসাব", "Shariah-Compliant Zakat Calculation")}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {L("হাতের ও ব্যাংকের নগদ, বিক্রির জন্য রাখা গরুর মূল্য ও খাবারের স্টক থেকে দেনা বাদ দিয়ে নিজে থেকে হিসাব হয়।", "Auto-populated from your live liquid cash (hand + bank), tradable livestock valuation, and feed supplies inventory minus immediate operational liabilities.")}
            </p>
          </div>
          <ZakatCalculator
            cattlePurchaseValue={activeCattleValuation}
            activeCattleCount={activeCattle}
            inventoryValue={totalInventoryValue}
            outstandingLoans={totalLiabilities}
            cashBalance={totalLiquidCash}
          />
        </div>
      )}

      {/* ── Executive Document Report (Screen & Print Target) ── */}
      <div className={cn(activeTab !== "summary" && "hidden print:block", "space-y-6")}>
        <div className="rounded-2xl border border-border bg-card shadow-sm print:shadow-none print:border-none p-6 sm:p-8 space-y-6">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-foreground/80 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary print:text-black" />
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground print:text-black">
                  {bizName}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground font-medium print:text-slate-600">
                {L("খামারের সার্বিক হিসাব বিবরণী", "Enterprise Livestock & Farm Management System · Consolidated Operations Report")}
              </p>
            </div>
            <div className="text-left sm:text-right space-y-0.5 text-xs text-muted-foreground print:text-slate-600">
              <p className="font-semibold text-foreground print:text-black">{L("রেফারেন্স", "Ref")}: {reportId}</p>
              <p>{L("তৈরি", "Generated")}: {reportDate}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 print:border-black print:text-black mt-1">
                <CheckCircle2 className="h-3 w-3" /> {L("খামারের রেকর্ড", "Farm record")}
              </span>
            </div>
          </div>

          {/* ── Section 1: Executive KPI Tiles ── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2 mb-3">
              {L("১. সারসংক্ষেপ", "1. Executive Summary & Key Metrics")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{L("খামারে গরু", "Active Herd")}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{L(`${activeCattle}টি`, `${activeCattle} head`)}</p>
                <p className="text-[11px] text-muted-foreground">{L(`মোট ${totalCattle}টির মধ্যে`, `of ${totalCattle} registered`)}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{L("গরুর মূল্য", "Herd Valuation")}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{fmt(activeCattleValuation)}</p>
                <p className="text-[11px] text-muted-foreground">{L("খামারে থাকা গরুর কেনা দাম", "Cost basis in active stock")}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{L("নগদ টাকা", "Liquid Cash")}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{fmt(totalLiquidCash)}</p>
                <p className="text-[11px] text-muted-foreground">{L("হাতে", "Hand")}: {fmt(cashBalance)} · {L("ব্যাংকে", "Bank")}: {fmt(bankBalance)}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{L("নিট মূলধন", "Net Equity")}</p>
                <p className={cn("text-xl font-bold tabular-nums", netEquity >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                  {fmt(netEquity)}
                </p>
                <p className="text-[11px] text-muted-foreground">{L("সম্পদ − দেনা", "Assets less liabilities")}</p>
              </div>
            </div>
          </div>
          {/* ── Section 2: Financial Performance & Livestock Assets (2-col) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Realized P&L */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
                {L("২. বিক্রি থেকে লাভ/ক্ষতি", "2. Realized Trading Performance (P&L)")}
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  <tr className="py-2">
                    <td className="py-2 text-muted-foreground">{L(`মোট বিক্রি (${soldCattle}টি গরু)`, `Total sales (${soldCattle} head)`)}</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{fmt(revenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("বিক্রি করা গরুর খরচ", "Cost of Cattle Sold")}</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(soldCattleCost)})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("মোট খাবার খরচ", "Total Feed & Consumables")}</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(feedCost)})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("খামার ও চিকিৎসা খরচ", "Operating & Medical Expenses")}</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(operatingCosts)})
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-2.5 px-2 font-bold text-foreground">{L("নিট লাভ / (ক্ষতি)", "Net Realized Profit / (Loss)")}</td>
                    <td className={cn(
                      "py-2.5 px-2 text-right font-bold font-mono tabular-nums text-sm",
                      netPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                    )}>
                      {netPL >= 0 ? `+${fmt(netPL)}` : `(${fmt(Math.abs(netPL))})`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Asset Valuation & Net Worth */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
                {L("৩. সম্পদ ও নিট মূল্য", "3. Statement of Net Worth & Assets")}
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("নগদ (হাতে + ব্যাংকে)", "Liquid Funds (Cash + Bank)")}</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(totalLiquidCash)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("খামারের গরুর মূল্য", "Active Herd Asset Valuation")}</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(activeCattleValuation)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">{L("খাবার ও স্টক", "Feed & Inventory On Hand")}</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(totalInventoryValue)}</td>
                  </tr>
                  <tr className="bg-muted/10 font-semibold">
                    <td className="py-2 text-foreground">{L("মোট সম্পদ", "Total Gross Assets")}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-foreground">
                      {fmt(totalLiquidCash + activeCattleValuation + totalInventoryValue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-rose-600">{L("বাদ: দেনা ও বকেয়া", "Less: Outstanding Liabilities & Dues")}</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(totalLiabilities)})
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-2.5 px-2 font-bold text-foreground">{L("খামারের নিট মূল্য", "Net Farm Equity")}</td>
                    <td className="py-2.5 px-2 text-right font-bold font-mono tabular-nums text-sm text-foreground">
                      {fmt(netEquity)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {/* ── Section 4: Feed & Inventory Itemized Table ── */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
              {L("৪. বর্তমান স্টক", "4. Current Stock & Inventory Register")}
            </h3>
            {inventoryWithStock.length > 0 ? (
              <div className="rounded-xl border border-border/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                      <th className="py-2.5 px-3 text-left font-semibold">{L("জিনিস", "Item Description")}</th>
                      <th className="py-2.5 px-3 text-left font-semibold">{L("ধরন", "Category")}</th>
                      <th className="py-2.5 px-3 text-right font-semibold">{L("পরিমাণ", "Stock Qty")}</th>
                      <th className="py-2.5 px-3 text-right font-semibold">{L("গড় দাম", "Avg Unit Cost")}</th>
                      <th className="py-2.5 px-3 text-right font-semibold">{L("মূল্য", "Valuation")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {inventoryWithStock.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground">{item.name}</td>
                        <td className="py-2 px-3 text-muted-foreground capitalize">{item.category}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                          {fmt(item.avgCost)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-foreground">
                          {fmt(item.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 border-t border-border font-bold">
                      <td colSpan={4} className="py-2.5 px-3 text-foreground">{L("মোট স্টকের মূল্য", "Total Inventory Valuation")}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-foreground">
                        {fmt(totalInventoryValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">{L("স্টকে কিছু নেই।", "No inventory items currently in stock.")}</p>
            )}
          </div>

          {/* ── Document Signatures & Certification Block ── */}
          <div className="pt-6 border-t border-border/80 space-y-6">
            <div className="grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-4">
                <p className="text-muted-foreground">{L("প্রস্তুতকারী:", "Prepared & Verified By:")}</p>
                <div className="border-b border-foreground/40 w-48 h-8" />
                <p className="font-semibold text-foreground">{L("হিসাবরক্ষক / ব্যবস্থাপক", "Farm Accountant / Operations Lead")}</p>
              </div>
              <div className="space-y-4 text-right">
                <p className="text-muted-foreground">{L("অনুমোদনকারী:", "Authorized & Approved By:")}</p>
                <div className="border-b border-foreground/40 w-48 h-8 ml-auto" />
                <p className="font-semibold text-foreground">{L("মালিক", "Managing Director / Owner")}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/40">
              <span>{bizName}</span>
              <span>{L("রেফারেন্স", "Ref")}: {reportId}</span>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

