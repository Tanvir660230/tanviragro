import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccountingData } from "@/lib/accounting/engine";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { buttonVariants } from "@/components/ui/button";
import {
  BookOpen,
  Scale,
  TrendingUp,
  Droplets,
  Package,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { FinancialLockManager } from "@/components/accounting/FinancialLockManager";
import { PageHeader } from "@/components/shared/PageHeader";
import type { FinancialLock } from "@/types/database";

export const metadata: Metadata = { title: "Accounting" };

function fmt(n: number) {
  return `৳${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl bg-card border border-border/70 shadow-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          positive === undefined
            ? ""
            : positive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function NavCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl bg-card border border-border/70 shadow-card p-4 hover:bg-muted/40 hover:shadow-card-md transition-all duration-150"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

export default async function AccountingPage() {

  const supabase = await createClient();

  // Run accounting engine + business ID lookup in parallel — neither depends on the other
  const [data, businessId] = await Promise.all([
    getAccountingData(supabase),
    getCurrentBusinessId(supabase),
  ]);
  const { incomeStatement: is, balanceSheet: bs, trialBalance: tb, fixedAssets } = data;

  const activeAssets = fixedAssets.filter((a) => a.isActive);

  const { data: locksData } = businessId
    ? await supabase.from("financial_locks").select("*").eq("business_id", businessId).order("locked_until", { ascending: false })
    : { data: [] };
  const locks = (locksData ?? []) as FinancialLock[];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        subtitle={`Double-entry financial statements — as of ${new Date(data.asOf).toLocaleDateString("en-US", { dateStyle: "long" })}`}
        icon={BookOpen}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue" value={fmt(is.totalRevenue)} sub="Total cattle sales" />
        <StatCard
          label="Net Income"
          value={`${is.netIncome >= 0 ? "" : "-"}${fmt(is.netIncome)}`}
          sub="After all expenses"
          positive={is.netIncome >= 0}
        />
        <StatCard label="Total Assets" value={fmt(bs.totalAssets)} sub="Balance sheet" />
        <StatCard
          label="Fixed Assets"
          value={fmt(activeAssets.reduce((s, a) => s + a.bookValue, 0))}
          sub={`${activeAssets.length} asset${activeAssets.length !== 1 ? "s" : ""} (book value)`}
        />
      </div>

      {/* Trial balance status */}
      <div className={`flex items-center gap-3 rounded-xl p-4 border ${
        tb.isBalanced
          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/40 text-amber-700 dark:text-amber-400"
      }`}>
        {tb.isBalanced
          ? <CheckCircle2 className="h-5 w-5 shrink-0" />
          : <AlertCircle className="h-5 w-5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {tb.isBalanced ? "Books are balanced" : "Trial balance discrepancy"}
          </p>
          <p className="text-xs opacity-80">
            DR {fmt(tb.totalDebit)} · CR {fmt(tb.totalCredit)}
          </p>
        </div>
        <Link
          href="/dashboard/accounting/trial-balance"
          className="text-xs font-medium underline underline-offset-2"
        >
          View →
        </Link>
      </div>

      {/* Financial Locks */}
      <FinancialLockManager locks={locks} />

      {/* Reports nav */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/60" />
          <h2 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wide select-none">Financial Reports</h2>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <NavCard
            href="/dashboard/accounting/trial-balance"
            icon={Scale}
            title="Trial Balance"
            description="All account debits & credits — verify books are balanced"
          />
          <NavCard
            href="/dashboard/accounting/balance-sheet"
            icon={BookOpen}
            title="Balance Sheet"
            description="Assets, liabilities, and equity at a glance"
          />
          <NavCard
            href="/dashboard/accounting/income-statement"
            icon={TrendingUp}
            title="Income Statement"
            description="Revenue, COGS, expenses, and net income"
          />
          <NavCard
            href="/dashboard/accounting/cash-flow"
            icon={Droplets}
            title="Cash Flow Statement"
            description="Operating, investing, and financing activities"
          />
          <NavCard
            href="/dashboard/accounting/fixed-assets"
            icon={Package}
            title="Fixed Assets & Depreciation"
            description="Sheds, pumps, equipment — straight-line & declining balance"
          />
        </div>
      </div>
    </div>
  );
}
