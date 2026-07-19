import { PageHeader } from "@/components/shared/PageHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Cash Flow Statement" };

function fmt(n: number) {
  const abs = `৳${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return n < 0 ? `(${abs})` : abs;
}

function Row({ label, value, indent, bold, border }: {
  label: string;
  value: number;
  indent?: boolean;
  bold?: boolean;
  border?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <div className={`flex items-start justify-between py-2 px-4 gap-4 ${border ? "border-t border-foreground/20" : "border-b border-border/40"} ${bold ? "font-semibold" : ""}`}>
      <span className={indent ? "pl-4 text-sm text-muted-foreground" : "text-sm"}>{label}</span>
      <span className={`tabular-nums font-mono text-sm shrink-0 ${isNeg ? "text-red-600 dark:text-red-400" : ""}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 bg-muted/30 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function CashFlowPage() {
   
  const supabase = await createClient();
  const { cashFlow: cf, asOf } = await getAccountingData(supabase);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Flow Statement"
        subtitle={`Direct method · as of ${new Date(asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        back="/dashboard/accounting"
      />

      {/* Operating — full width (most rows) */}
      <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
        <SectionHeader>OPERATING ACTIVITIES</SectionHeader>
        <Row label="Cash received from cattle sales" value={cf.cashFromSales} indent />
        <Row label="Cash paid for cattle purchases" value={-cf.cashPaidCattle} indent />
        <Row label="Cash paid for operating costs" value={-cf.cashPaidCosts} indent />
        <Row label="Cash paid for feed & supplies" value={-cf.cashPaidInventory} indent />
        <Row label="Net Cash from Operating Activities" value={cf.netOperating} bold border />
      </div>

      {/* Investing + Financing — side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>INVESTING ACTIVITIES</SectionHeader>
          <Row label="Fixed asset purchases" value={-cf.fixedAssetPurchases} indent />
          <Row label="Net Cash from Investing Activities" value={cf.netInvesting} bold border />
        </div>
        <div className="rounded-xl bg-card border border-border/60 shadow-card overflow-hidden">
          <SectionHeader>FINANCING ACTIVITIES</SectionHeader>
          <Row label="Partner investments received" value={cf.partnerInvestments} indent />
          <Row label="Partner withdrawals paid" value={-cf.partnerWithdrawals} indent />
          <Row label="Net Cash from Financing Activities" value={cf.netFinancing} bold border />
        </div>
      </div>

      {/* Net */}
      <div className="rounded-xl ring-2 overflow-hidden" style={{
        borderColor: cf.netCashFlow >= 0 ? "oklch(0.6 0.15 145 / 0.5)" : "rgb(220 38 38 / 0.3)"
      }}>
        <div className={`px-4 py-4 ${cf.netCashFlow >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/30"}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-base">NET CHANGE IN CASH</span>
            <span className={`text-2xl font-bold tabular-nums ${
              cf.netCashFlow >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {cf.netCashFlow < 0 ? "−" : ""}{fmt(cf.netCashFlow)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
