import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import {
  BookOpen,
  Scale,
  TrendingUp,
  Droplets,
  Package,
  ArrowRight,
  ShieldCheck,
  Building2,
  DollarSign,
  Wallet,
  Landmark,
  AlertCircle,
} from "lucide-react";
import { FinancialLockManager } from "@/components/accounting/FinancialLockManager";
import { FinancialStatCard, fmtBDT } from "@/components/finance/finance-ui";
import type { FinancialLock } from "@/types/database";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PERMISSIONS } from "@/constants/roles";
import { SitePageTitle } from "@/components/navigation/SitePageTitle";

import { getL } from "@/i18n/server-text";
export const metadata: Metadata = { title: "হিসাবের খাতা" };

function NavCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  accentColor = "text-primary",
  accentBg = "bg-primary/10",
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  accentColor?: string;
  accentBg?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 rounded-2xl bg-card border border-border/80 p-5 shadow-sm hover:border-border hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", accentBg)}>
        <Icon className={cn("h-6 w-6", accentColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-foreground tracking-tight">{title}</p>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80 transition-all">
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

export default async function AccountingPage() {
  const L = await getL();
  await requirePagePermission(PERMISSIONS.ACCOUNTING_VIEW);
  const supabase = await createClient();

  // Run accounting engine + business ID lookup in parallel — neither depends on the other
  const [data, businessId] = await Promise.all([
    getAccountingData(supabase),
    getCurrentBusinessId(supabase),
  ]);
  const { incomeStatement: is, balanceSheet: bs, trialBalance: tb, fixedAssets } = data;

  const activeAssets = fixedAssets.filter((a) => a.isActive);
  const totalFixedAssetBookValue = activeAssets.reduce((s, a) => s + a.bookValue, 0);

  const { data: locksData } = businessId
    ? await supabase
        .from("financial_locks")
        .select("*")
        .eq("business_id", businessId)
        .order("locked_until", { ascending: false })
    : { data: [] };
  const locks = (locksData ?? []) as FinancialLock[];

  const netMargin = is.totalRevenue > 0 ? (is.netIncome / is.totalRevenue) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              <SitePageTitle fallback="Accounts" />
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {L(`আয়-ব্যয়, ব্যালেন্স শিট ও খাতার হিসাব · ${data.asOf.slice(0, 10)} পর্যন্ত`, `Statements and ledger balances · as of ${data.asOf.slice(0, 10)}`)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/finance"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            {L("খরচ ও টাকা", "Finance & P&L")}
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FinancialStatCard
          label={L("মোট বিক্রি", "Total Revenue")}
          value={fmtBDT(is.totalRevenue)}
          subtext={L("শুরু থেকে গরু বিক্রি", "Lifetime cattle sales")}
          icon={TrendingUp}
          variant="success"
        />
        <FinancialStatCard
          label={L("নিট লাভ/ক্ষতি", "Net Income")}
          value={fmtBDT(is.netIncome)}
          subtext={netMargin !== null ? L(`${netMargin.toFixed(1)}% নিট মার্জিন`, `${netMargin.toFixed(1)}% net margin`) : L("সব খরচ বাদে", "After all expenses")}
          icon={Wallet}
          variant={is.netIncome >= 0 ? "success" : "danger"}
          isPositive={is.netIncome >= 0}
        />
        <FinancialStatCard
          label={L("মোট সম্পদ", "Total Assets")}
          value={fmtBDT(bs.totalAssets)}
          subtext={L("নগদ + খাবার + গরু + স্থায়ী সম্পদ", "Cash + Feed + Cattle + Assets")}
          icon={Building2}
          variant="blue"
        />
        <FinancialStatCard
          label={L("স্থায়ী সম্পদ", "Fixed Assets")}
          value={fmtBDT(totalFixedAssetBookValue)}
          subtext={L(`${activeAssets.length}টি সক্রিয় সম্পদ`, `${activeAssets.length} active asset${activeAssets.length !== 1 ? "s" : ""}`)}
          icon={Package}
          variant="purple"
        />
      </div>

      {/* Trial Balance Health Banner */}
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl p-5 border shadow-sm transition-all",
          tb.isBalanced
            ? "bg-emerald-500/[0.04] border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
            : "bg-amber-500/[0.04] border-amber-500/30 text-amber-950 dark:text-amber-100"
        )}
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={cn(
              "rounded-xl p-2.5 shrink-0",
              tb.isBalanced ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            )}
          >
            {tb.isBalanced ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold tracking-tight">
                {tb.isBalanced ? L("খাতার ডেবিট ও ক্রেডিট মিলে গেছে", "Debits and credits balance") : L("খাতায় গরমিল আছে", "The ledger does not balance")}
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                  tb.isBalanced
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                )}
              >
                {tb.isBalanced ? L("ঠিক আছে", "OK") : L("দেখতে হবে", "Check")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {L("মোট ডেবিট", "Total debits")}: <span className="font-mono font-medium">{fmtBDT(tb.totalDebit)}</span> · {L("মোট ক্রেডিট", "Total credits")}:{" "}
              <span className="font-mono font-medium">{fmtBDT(tb.totalCredit)}</span>
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/accounting/trial-balance"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-card border border-border/80 px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-colors"
        >
          {L("রেওয়ামিল দেখুন", "View Trial Balance")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Financial Locks */}
      <FinancialLockManager locks={locks} />

      {/* Reports Nav Grid */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
            {L("হিসাবের বিবরণী", "Financial Statements & Schedules")}
          </h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <NavCard
            href="/dashboard/accounting/balance-sheet"
            icon={BookOpen}
            title={L("ব্যালেন্স শিট", "Balance Sheet")}
            description={L("সম্পদ, দায়, অংশীদারের মূলধন ও জমা লাভ/ক্ষতি", "Assets, liabilities, partner capital, and retained earnings")}
            accentColor="text-blue-600 dark:text-blue-400"
            accentBg="bg-blue-500/10"
          />
          <NavCard
            href="/dashboard/accounting/income-statement"
            icon={TrendingUp}
            title={L("আয়-ব্যয় বিবরণী", "Income Statement (P&L)")}
            description={L("বিক্রি, বিক্রি করা গরুর খরচ, চলতি খরচ ও নিট লাভ", "Revenue, Cost of Goods Sold, operating expenses, and net profit")}
            accentColor="text-emerald-600 dark:text-emerald-400"
            accentBg="bg-emerald-500/10"
          />
          <NavCard
            href="/dashboard/accounting/cash-flow"
            icon={Droplets}
            title={L("নগদ প্রবাহ", "Cash Flow Statement")}
            description={L("টাকা কোথা থেকে এলো, কোথায় গেলো", "Direct method: operating, investing, and financing cash flows")}
            accentColor="text-cyan-600 dark:text-cyan-400"
            accentBg="bg-cyan-500/10"
          />
          <NavCard
            href="/dashboard/accounting/trial-balance"
            icon={Scale}
            title={L("রেওয়ামিল", "Trial Balance Ledger")}
            description={L("প্রতিটি হিসাবের ডেবিট ও ক্রেডিট", "Chart of accounts with verified debit and credit totals")}
            accentColor="text-amber-600 dark:text-amber-400"
            accentBg="bg-amber-500/10"
          />
          <NavCard
            href="/dashboard/accounting/fixed-assets"
            icon={Package}
            title={L("স্থায়ী সম্পদ ও অবচয়", "Fixed Assets & Depreciation")}
            description={L("শেড, যন্ত্রপাতি — কত দাম, কতটা ক্ষয় হলো", "Sheds, equipment, machinery, straight-line & declining schedules")}
            accentColor="text-purple-600 dark:text-purple-400"
            accentBg="bg-purple-500/10"
          />
          <NavCard
            href="/dashboard/finance/loans"
            icon={Landmark}
            title={L("ঋণ", "Loans & Debt Tracker")}
            description={L("আসল, কিস্তি, সুদ ও পরিশোধের তারিখ", "Principal, repayments, accrued interest, and due dates")}
            accentColor="text-rose-600 dark:text-rose-400"
            accentBg="bg-rose-500/10"
          />
        </div>
      </div>
    </div>
  );
}
