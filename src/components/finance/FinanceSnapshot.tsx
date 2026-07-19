import Link from "next/link";
import {
  TrendingUp, TrendingDown, Wallet, Landmark,
  Package, ArrowRight, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getServerClient, getCachedBusinessId } from "@/lib/supabase/cached";
import { getCashBalance } from "@/lib/supabase/queries/cash";
import { getCachedTopBarAlerts } from "@/lib/supabase/topbar-alerts";
import { calcAccruedInterest } from "@/lib/loan-utils";

function fmt(n: number) {
  if (!isFinite(n) || isNaN(n)) return "৳—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}৳${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}৳${(abs / 1_000).toFixed(0)}K`;
  return `${sign}৳${Math.round(abs)}`;
}

type CardProps = {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  valueColor: string;
  label: string;
  sub: string;
  subColor?: string;
  tintClass: string;
};

function Card({ href, icon, iconBg, value, valueColor, label, sub, subColor, tintClass }: CardProps) {
  return (
    <Link href={href} className="group block">
      <div className={cn(
        "rounded-xl border p-4 transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5",
        tintClass
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", iconBg)}>
            {icon}
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
        </div>
        <p className={cn("text-2xl font-bold tabular-nums tracking-tight leading-none", valueColor)}>
          {value}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1.5">
          {label}
        </p>
        {sub && (
          <p className={cn("text-xs mt-0.5 leading-snug", subColor ?? "text-muted-foreground")}>
            {sub}
          </p>
        )}
      </div>
    </Link>
  );
}

export async function FinanceSnapshot() {
  const supabase = await getServerClient();
  const businessId = await getCachedBusinessId();
  if (!businessId) return null;

  const today = new Date();
  const todayISO       = today.toISOString().slice(0, 10);
  const firstOfMonth   = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const in7ISO         = new Date(today.getTime() +  7 * 86400000).toISOString().slice(0, 10);
  const in30ISO        = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAgoISO = new Date(today.getTime() -  7 * 86400000).toISOString().slice(0, 10);

  const [
    cash,
    { data: salesData },
    { data: loansData },
    alerts,
  ] = await Promise.all([
    getCashBalance(supabase, businessId),

    supabase
      .from("sales")
      .select("sale_price_total, cattle!inner(business_id)")
      .eq("cattle.business_id", businessId)
      .gte("sold_at", firstOfMonth)
      .is("deleted_at", null),

    supabase
      .from("loans")
      .select("principal_amount, interest_rate_pct, loan_date, status, due_date, loan_payments(amount, paid_at)")
      .eq("business_id", businessId)
      .eq("status", "active")
      .is("deleted_at", null),

    getCachedTopBarAlerts(businessId, todayISO, in7ISO, in30ISO, sevenDaysAgoISO),
  ]);

  // ── This-month revenue ────────────────────────────────────────────
  const monthRevenue = (salesData ?? []).reduce(
    (s, r) => s + Number((r as { sale_price_total: number }).sale_price_total), 0
  );

  // ── Cash balance ──────────────────────────────────────────────────
  const { balance } = cash;

  // ── Loans ─────────────────────────────────────────────────────────
  type LoanRow = {
    principal_amount: number;
    interest_rate_pct: number;
    loan_date: string;
    status: string;
    due_date: string | null;
    loan_payments: { amount: number; paid_at: string }[] | null;
  };
  const loans = (loansData ?? []) as LoanRow[];

  const totalOutstanding = loans.reduce((s, l) => {
    const paid = (l.loan_payments ?? []).reduce((ps, p) => ps + Number(p.amount), 0);
    const interest = calcAccruedInterest(
      Number(l.principal_amount),
      Number(l.interest_rate_pct ?? 0),
      l.loan_date,
      todayISO,
      l.loan_payments || [],
      "active"
    );
    return s + Math.max(0, Number(l.principal_amount) + interest - paid);
  }, 0);

  const overdueCount  = loans.filter(l => l.due_date && l.due_date < todayISO).length;
  const dueSoonCount  = loans.filter(l => l.due_date && l.due_date >= todayISO && l.due_date <= in30ISO).length;

  // ── Inventory ─────────────────────────────────────────────────────
  const lowStockCount = alerts.lowStockItems.length;

  // ── Card configs ──────────────────────────────────────────────────
  const cards: CardProps[] = [
    // 1 — This-month sales
    {
      href: "/dashboard/finance",
      icon: monthRevenue > 0
        ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        : <TrendingDown className="h-4 w-4 text-muted-foreground" />,
      iconBg: monthRevenue > 0 ? "bg-emerald-500/15" : "bg-muted",
      value: monthRevenue > 0 ? fmt(monthRevenue) : "৳০",
      valueColor: monthRevenue > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
      label: "এই মাসে বিক্রি",
      sub: monthRevenue > 0 ? "বিক্রির আয় · P&L দেখতে ক্লিক করুন" : "এখনো বিক্রি নেই",
      subColor: monthRevenue > 0 ? "text-emerald-600/70 dark:text-emerald-400/70" : undefined,
      tintClass: monthRevenue > 0
        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
        : "bg-card border-border",
    },

    // 2 — Cash balance
    {
      href: "/dashboard/accounting",
      icon: <Wallet className={cn("h-4 w-4", balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400")} />,
      iconBg: balance >= 0 ? "bg-blue-500/15" : "bg-red-500/15",
      value: fmt(balance),
      valueColor: balance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300",
      label: "নগদ ব্যালেন্স",
      sub: balance >= 0 ? "উপলব্ধ নগদ" : "ঘাটতি — মনোযোগ দিন",
      subColor: balance >= 0 ? "text-blue-600/70 dark:text-blue-400/70" : "text-red-600 dark:text-red-400",
      tintClass: balance >= 0
        ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50"
        : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50",
    },

    // 3 — Loans outstanding
    {
      href: "/dashboard/finance/loans",
      icon: <Landmark className={cn("h-4 w-4",
        overdueCount > 0 ? "text-red-600 dark:text-red-400" :
        loans.length > 0 ? "text-amber-600 dark:text-amber-400" :
        "text-muted-foreground"
      )} />,
      iconBg: overdueCount > 0 ? "bg-red-500/15" : loans.length > 0 ? "bg-amber-500/15" : "bg-muted",
      value: loans.length > 0 ? fmt(totalOutstanding) : "ঋণ নেই",
      valueColor: overdueCount > 0
        ? "text-red-700 dark:text-red-300"
        : loans.length > 0 ? "text-amber-700 dark:text-amber-300"
        : "text-muted-foreground",
      label: "মোট ঋণ বাকি",
      sub: overdueCount > 0
        ? `${overdueCount}টি overdue! এখনই পরিশোধ করুন`
        : dueSoonCount > 0 ? `${dueSoonCount}টি ৩০ দিনে due`
        : loans.length > 0 ? `${loans.length}টি active loan`
        : "কোনো সক্রিয় ঋণ নেই",
      subColor: overdueCount > 0
        ? "text-red-600 dark:text-red-400 font-semibold"
        : dueSoonCount > 0 ? "text-amber-600 dark:text-amber-400"
        : undefined,
      tintClass: overdueCount > 0
        ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50"
        : loans.length > 0
        ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
        : "bg-card border-border",
    },

    // 4 — Inventory / feed stock
    {
      href: "/dashboard/inventory",
      icon: lowStockCount > 0
        ? <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        : <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: lowStockCount > 0 ? "bg-orange-500/15" : "bg-emerald-500/15",
      value: lowStockCount > 0 ? `${lowStockCount}টি কম` : "সব ঠিক",
      valueColor: lowStockCount > 0
        ? "text-orange-700 dark:text-orange-300"
        : "text-emerald-700 dark:text-emerald-300",
      label: "স্টক অবস্থা",
      sub: lowStockCount > 0
        ? "কম স্টক — অর্ডার করুন"
        : "পর্যাপ্ত মজুদ আছে",
      subColor: lowStockCount > 0
        ? "text-orange-600 dark:text-orange-400 font-semibold"
        : "text-emerald-600/70 dark:text-emerald-400/70",
      tintClass: lowStockCount > 0
        ? "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50"
        : "bg-card border-border",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card, i) => <Card key={i} {...card} />)}
    </div>
  );
}

export function FinanceSnapshotSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-8 w-8 rounded-xl bg-muted" />
            <div className="h-3 w-3 rounded-full bg-muted" />
          </div>
          <div className="h-7 w-24 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-3 w-28 rounded bg-muted opacity-60" />
        </div>
      ))}
    </div>
  );
}
