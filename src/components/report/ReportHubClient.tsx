"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText, Download, Building2, TrendingUp, Scale,
  DollarSign, Activity, Layers, ShieldCheck, CheckCircle2,
  PieChart, ArrowRight, Calculator, Search, BookOpen, Calendar, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { ZakatCalculator } from "@/components/finance/ZakatCalculator";
import { cn } from "@/lib/utils";


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
  const data = "data" in props && (props as { data: ReportHubData }).data ? (props as { data: ReportHubData }).data : (props as ReportHubData & { analyticsPayload?: any });
  const [activeTab, setActiveTab] = useState<"summary" | "directory" | "zakat">("summary");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    bizName, reportDate, reportId, totalCattle, activeCattle, soldCattle,
    activeCattleValuation, revenue, soldCattleCost, feedCost, operatingCosts,
    netPL, cashBalance, bankBalance, totalLiquidCash, totalInventoryValue,
    inventoryWithStock, totalLiabilities, netEquity, zakatAssets,
  } = data;

  function exportSummaryCSV() {
    const csvRows = [
      ["Report Title", `"${bizName} Farm Executive Report"`],
      ["Report Reference", `"${reportId}"`],
      ["Generated Date", `"${reportDate}"`],
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
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.stock,
        item.unit,
        Math.round(item.avgCost),
        Math.round(item.value),
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `farm_report_${bizName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const statementLinks = [
    { title: "Balance Sheet", desc: "Statement of financial position, assets, liabilities, and cumulative equity", href: "/dashboard/accounting/balance-sheet", icon: Scale, badge: "Double-Entry" },
    { title: "Income Statement", desc: "Multi-step GAAP statement of profit and loss with gross & net margin analysis", href: "/dashboard/accounting/income-statement", icon: TrendingUp, badge: "GAAP" },
    { title: "Cash Flow Statement", desc: "Operating, investing, and financing cash movements over time", href: "/dashboard/accounting/cash-flow", icon: DollarSign, badge: "Audited" },
    { title: "Trial Balance Ledger", desc: "Chart of accounts debit and credit balances with double-entry integrity check", href: "/dashboard/accounting/trial-balance", icon: Layers, badge: "Audit Ledger" },
    { title: "Fixed Assets & Depreciation", desc: "Capital assets register with straight-line depreciation schedules", href: "/dashboard/accounting/fixed-assets", icon: Building2, badge: "Depreciation" },
    { title: "Health & Compliance Certification", desc: "Official DLS Bangladesh vaccination schedule and veterinary declaration certificate", href: "/dashboard/compliance/report", icon: ShieldCheck, badge: "DLS Official" },
    { title: "Investor / Partner Ledger", desc: "Individual partner capital accounts, profit distributions, and statement prints", href: "/dashboard/partners", icon: PieChart, badge: "Equity" },
  ];

  const filteredStatements = statementLinks.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                Enterprise Report Center
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Consolidated business intelligence, audited financial statements &amp; print hub
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
            Export CSV
          </Button>
          <PrintButton label="Print Report" />
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
            Farm Financial Statement
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={cn(
              "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "directory"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Statement Directory
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
            Zakat Estimator
          </button>
        </div>

        <div className="text-xs text-muted-foreground hidden md:flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Report Date: <span className="font-semibold text-foreground">{reportDate}</span>
        </div>
      </div>
      {/* ── Directory Tab ── */}
      {activeTab === "directory" && (
        <div className="space-y-4 print:hidden animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search financial statements, audit reports, or compliance certificates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStatements.map((s, idx) => {
              const Icon = s.icon;
              return (
                <Link
                  key={idx}
                  href={s.href}
                  className="group rounded-2xl border border-border/70 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="rounded-xl bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60">
                        {s.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                        {s.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between text-xs font-medium text-primary">
                    <span>Open official statement</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Zakat Tab ── */}
      {activeTab === "zakat" && (
        <div className="space-y-4 print:hidden animate-fade-in">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Shariah-Compliant Zakat Calculation
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Auto-populated from your live liquid cash (hand + bank), tradable livestock valuation, and feed supplies inventory minus immediate operational liabilities.
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
                Enterprise Livestock &amp; Farm Management System · Consolidated Operations Report
              </p>
            </div>
            <div className="text-left sm:text-right space-y-0.5 text-xs text-muted-foreground print:text-slate-600">
              <p className="font-semibold text-foreground print:text-black">Doc Ref: {reportId}</p>
              <p>Generated: {reportDate}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 print:border-black print:text-black mt-1">
                <CheckCircle2 className="h-3 w-3" /> Official Farm Record
              </span>
            </div>
          </div>

          {/* ── Section 1: Executive KPI Tiles ── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2 mb-3">
              1. Executive Summary &amp; Key Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Herd</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{activeCattle} head</p>
                <p className="text-[11px] text-muted-foreground">of {totalCattle} total registered</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Herd Valuation</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{fmt(activeCattleValuation)}</p>
                <p className="text-[11px] text-muted-foreground">Cost basis in active stock</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Liquid Cash</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{fmt(totalLiquidCash)}</p>
                <p className="text-[11px] text-muted-foreground">Hand: {fmt(cashBalance)} · Bank: {fmt(bankBalance)}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Net Equity</p>
                <p className={cn("text-xl font-bold tabular-nums", netEquity >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                  {fmt(netEquity)}
                </p>
                <p className="text-[11px] text-muted-foreground">Assets less liabilities</p>
              </div>
            </div>
          </div>
          {/* ── Section 2: Financial Performance & Livestock Assets (2-col) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Realized P&L */}
            <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
                2. Realized Trading Performance (P&amp;L)
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  <tr className="py-2">
                    <td className="py-2 text-muted-foreground">Total Sales Revenue ({soldCattle} head)</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{fmt(revenue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Cost of Cattle Sold</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(soldCattleCost)})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Total Feed &amp; Consumables</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(feedCost)})
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Operating &amp; Medical Expenses</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(operatingCosts)})
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-2.5 px-2 font-bold text-foreground">Net Realized Profit / (Loss)</td>
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
                3. Statement of Net Worth &amp; Assets
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-2 text-muted-foreground">Liquid Funds (Cash + Bank)</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(totalLiquidCash)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Active Herd Asset Valuation</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(activeCattleValuation)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-muted-foreground">Feed &amp; Inventory On Hand</td>
                    <td className="py-2 text-right font-semibold font-mono tabular-nums">{fmt(totalInventoryValue)}</td>
                  </tr>
                  <tr className="bg-muted/10 font-semibold">
                    <td className="py-2 text-foreground">Total Gross Assets</td>
                    <td className="py-2 text-right font-mono tabular-nums text-foreground">
                      {fmt(totalLiquidCash + activeCattleValuation + totalInventoryValue)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-rose-600">Less: Outstanding Liabilities &amp; Dues</td>
                    <td className="py-2 text-right font-medium font-mono tabular-nums text-rose-600">
                      ({fmt(totalLiabilities)})
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="py-2.5 px-2 font-bold text-foreground">Net Farm Equity</td>
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
              4. Current Stock &amp; Inventory Register
            </h3>
            {inventoryWithStock.length > 0 ? (
              <div className="rounded-xl border border-border/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                      <th className="py-2.5 px-3 text-left font-semibold">Item Description</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Category</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Stock Qty</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Avg Unit Cost</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Valuation</th>
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
                      <td colSpan={4} className="py-2.5 px-3 text-foreground">Total Inventory Valuation</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-foreground">
                        {fmt(totalInventoryValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No inventory items currently in stock.</p>
            )}
          </div>

          {/* ── Document Signatures & Certification Block ── */}
          <div className="pt-6 border-t border-border/80 space-y-6">
            <div className="grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-4">
                <p className="text-muted-foreground">Prepared &amp; Verified By:</p>
                <div className="border-b border-foreground/40 w-48 h-8" />
                <p className="font-semibold text-foreground">Farm Accountant / Operations Lead</p>
              </div>
              <div className="space-y-4 text-right">
                <p className="text-muted-foreground">Authorized &amp; Approved By:</p>
                <div className="border-b border-foreground/40 w-48 h-8 ml-auto" />
                <p className="font-semibold text-foreground">Managing Director / Owner</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/40">
              <span>{bizName} Enterprise Management System · Standard Audit Format</span>
              <span>Ref: {reportId} · Page 1 of 1</span>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

