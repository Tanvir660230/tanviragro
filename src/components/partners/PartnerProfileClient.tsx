"use client";

import { useState, useActionState, useEffect, useTransition } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Banknote,
  TrendingDown,
  Plus,
  Wallet,
  TrendingUp,
  Clock,
  Layers,
  Wrench,
  Pencil,
  Trash2,
  ChevronRight,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addPartnerTransaction,
  updatePartner,
  deletePartner,
  deletePartnerTransaction,
} from "@/app/dashboard/(app)/partners/actions";
import type {
  Partner,
  PartnerTransaction,
  PartnerTransactionType,
  PartnerType,
} from "@/types/database";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FileText } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TxnFilter = "all" | "investment" | "withdrawal" | "profit" | "loss_allocation";

export interface PartnerAccountSummary {
  totalInvested: number;
  withdrawn: number;
  profitReceived: number;
  lossBorne: number;
  laborValue: number;
  months: number;
  equity: number;
  pendingProfit: number;
  pendingLoss: number;
}

interface Props {
  partner: Partner;
  transactions: PartnerTransaction[];
  sharePct: number;
  acc: PartnerAccountSummary;
  totalBusinessValue: number;
  hasMarketPrice: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-indigo-500",
  "bg-pink-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const TXN_META: Record<
  PartnerTransactionType,
  { label: string; sign: "+" | "−"; textCls: string; bgCls: string }
> = {
  investment: {
    label: "Capital In",
    sign: "+",
    textCls: "text-emerald-600 dark:text-emerald-400",
    bgCls: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  withdrawal: {
    label: "Withdrawal",
    sign: "−",
    textCls: "text-red-600 dark:text-red-400",
    bgCls: "bg-red-100 dark:bg-red-900/30",
  },
  profit: {
    label: "Profit Distribution",
    sign: "+",
    textCls: "text-violet-600 dark:text-violet-400",
    bgCls: "bg-violet-100 dark:bg-violet-900/30",
  },
  loss_allocation: {
    label: "Loss Allocation",
    sign: "−",
    textCls: "text-orange-600 dark:text-orange-400",
    bgCls: "bg-orange-100 dark:bg-orange-900/30",
  },
};

const TXN_ICON: Record<PartnerTransactionType, React.ElementType> = {
  investment: ArrowUpCircle,
  withdrawal: ArrowDownCircle,
  profit: Banknote,
  loss_allocation: TrendingDown,
};

const TYPE_CFG: Record<
  PartnerType,
  { cls: string; label: string }
> = {
  capital: {
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    label: "Capital Partner",
  },
  labor: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    label: "Labor Partner",
  },
  hybrid: {
    cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    label: "Capital + Labor",
  },
};

// ── Main Component ────────────────────────────────────────────────────────────

export function PartnerProfileClient({
  partner: p,
  transactions,
  sharePct,
  acc,
  totalBusinessValue,
  hasMarketPrice,
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [filter, setFilter] = useState<TxnFilter>("all");
  const [addTxnOpen, setAddTxnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null);
  const [confirmTxnId, setConfirmTxnId] = useState<string | null>(null);
  const [txnType, setTxnType] = useState<"investment" | "withdrawal">(
    "investment"
  );
  const [txnState, txnAction, txnPending] = useActionState(
    addPartnerTransaction,
    undefined
  );
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (txnState?.success) {
      toast.success("Transaction saved");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddTxnOpen(false);
    }
    if (txnState?.error) toast.error(txnState.error);
  }, [txnState]);

  // Build running balance (oldest → newest), display newest first
  const chronological = [...transactions].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const withBalance = chronological.reduce(
    (arr, txn) => {
      const last = arr.length > 0 ? arr[arr.length - 1].balance : 0;
      const delta =
        txn.type === "investment" || txn.type === "profit"
          ? txn.amount
          : -txn.amount;
      arr.push({ ...txn, balance: last + delta });
      return arr;
    },
    [] as (PartnerTransaction & { balance: number })[]
  );
  const allDisplayed = [...withBalance].reverse();

  const filterCounts = {
    all: transactions.length,
    investment: transactions.filter((t) => t.type === "investment").length,
    withdrawal: transactions.filter((t) => t.type === "withdrawal").length,
    profit: transactions.filter(
      (t) => t.type === "profit" || t.type === "loss_allocation"
    ).length,
    loss_allocation: 0,
  };

  const filterTabs: { key: TxnFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: filterCounts.all },
    {
      key: "investment",
      label: "Investments",
      count: filterCounts.investment,
    },
    {
      key: "withdrawal",
      label: "Withdrawals",
      count: filterCounts.withdrawal,
    },
    {
      key: "profit",
      label: "Distributions",
      count: filterCounts.profit,
    },
  ];

  const filtered =
    filter === "all"
      ? allDisplayed
      : filter === "profit"
      ? allDisplayed.filter(
          (t) => t.type === "profit" || t.type === "loss_allocation"
        )
      : allDisplayed.filter((t) => t.type === filter);

  const typeCfg = TYPE_CFG[p.partner_type ?? "capital"] ?? TYPE_CFG.capital;
  const avColor = avatarColor(p.name);
  const initStr = initials(p.name);
  const currentValue = Math.round((totalBusinessValue * sharePct) / 100);
  const isEquityPositive = acc.equity >= 0;

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePartner(p.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${p.name} removed`);
        router.push("/dashboard/partners");
      }
    });
  }

  async function handleDeleteTxn(id: string) {
    setDeletingTxnId(id);
    const result = await deletePartnerTransaction(id);
    setDeletingTxnId(null);
    setConfirmTxnId(null);
    if (result?.error) toast.error(result.error);
    else toast.success("Transaction deleted");
  }

  return (
    <div className="space-y-4">
      {/* ── Profile Hero ────────────────────────────────────────────── */}
      <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
        <div className={cn("h-1.5 w-full", avColor)} />
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={cn(
              "flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center",
              "text-white text-lg font-bold shadow-sm select-none",
              avColor
            )}>
              {initStr}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                    {p.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className={cn(
                      "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
                      typeCfg.cls
                    )}>
                      {typeCfg.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      {sharePct.toFixed(1)}%
                    </span>
                    {acc.pendingProfit > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Clock className="h-3 w-3" />
                        Profit due: {bdt(acc.pendingProfit)}
                      </span>
                    )}
                    {acc.pendingLoss > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <Clock className="h-3 w-3" />
                        Loss due: {bdt(acc.pendingLoss)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setAddTxnOpen(true)}
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Add Transaction</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm ? (
                    <div className="flex items-center gap-1.5 text-xs border border-destructive/30 rounded-lg px-2.5 py-1.5 bg-destructive/5">
                      <span className="text-destructive font-medium">Delete?</span>
                      <button onClick={handleDelete} disabled={isDeleting} className="text-destructive font-bold hover:underline">Yes</button>
                      <button onClick={() => setDeleteConfirm(false)} className="text-muted-foreground hover:underline">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-sm text-muted-foreground">
                <span>Joined {fmtDate(p.joined_at)}</span>
                <span>·</span>
                <span>{acc.months} month{acc.months !== 1 ? "s" : ""} active</span>
                {!p.bears_loss && p.partner_type !== "labor" && (
                  <><span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">No loss sharing</span></>
                )}
                {p.share_mode === "manual" && (
                  <><span>·</span><span>Fixed share</span></>
                )}
              </div>

              {p.notes && (
                <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-border pl-3">
                  {p.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      {(() => {
        const roi =
          acc.totalInvested > 0
            ? ((acc.equity - acc.totalInvested) / acc.totalInvested) * 100
            : null;
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProfileStatCard
              icon={Banknote}
              label="Total Invested"
              value={bdt(acc.totalInvested)}
              iconCls="text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
            />
            <ProfileStatCard
              icon={isEquityPositive ? TrendingUp : TrendingDown}
              label="Current Equity"
              value={(isEquityPositive ? "" : "−") + bdt(acc.equity)}
              valueColor={isEquityPositive ? "green" : "red"}
              iconCls={isEquityPositive
                ? "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
                : "text-destructive bg-red-100 dark:bg-red-900/30"
              }
              sub={roi !== null ? `ROI: ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : undefined}
            />
            <ProfileStatCard
              icon={Layers}
              label="Profit Share"
              value={`${sharePct.toFixed(1)}%`}
              iconCls="text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30"
            />
            <ProfileStatCard
              icon={Wallet}
              label="Profit Received"
              value={bdt(acc.profitReceived)}
              valueColor="green"
              iconCls="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
              sub={acc.pendingProfit > 0 ? `Pending: ${bdt(acc.pendingProfit)}` : undefined}
            />
          </div>
        );
      })()}

      {/* ── Capital Position ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-card border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Capital Account
          </h3>
          {p.share_mode === "auto" && (
            <span className="text-xs text-muted-foreground">
              Ratio-based allocation
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {p.partner_type !== "labor" && acc.totalInvested > 0 && (
            <PositionTile
              label="Invested"
              value={acc.totalInvested}
              sign="+"
              colorKey="blue"
            />
          )}
          {acc.laborValue > 0 && (
            <PositionTile
              label="Labor Value"
              value={acc.laborValue}
              sign="+"
              colorKey="amber"
              icon={<Wrench className="h-3 w-3" />}
            />
          )}
          {acc.withdrawn > 0 && (
            <PositionTile
              label="Withdrawn"
              value={acc.withdrawn}
              sign="−"
              colorKey="red"
            />
          )}
          {acc.profitReceived > 0 && (
            <PositionTile
              label="Profit Paid Out"
              value={acc.profitReceived}
              sign="+"
              colorKey="violet"
            />
          )}
          {acc.lossBorne > 0 && (
            <PositionTile
              label="Loss Borne"
              value={acc.lossBorne}
              sign="−"
              colorKey="orange"
            />
          )}
          {acc.pendingProfit > 0 && (
            <PositionTile
              label="Pending Profit"
              value={acc.pendingProfit}
              sign="+"
              colorKey="emerald"
              pending
            />
          )}
          {acc.pendingLoss > 0 && (
            <PositionTile
              label="Pending Loss"
              value={acc.pendingLoss}
              sign="−"
              colorKey="orange"
              pending
            />
          )}
        </div>

        {/* Equity summary bar */}
        {acc.totalInvested > 0 && (
          <div className="mt-4 space-y-1.5 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Net Equity
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  isEquityPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                )}
              >
                {isEquityPositive ? "+" : "−"}
                {bdt(acc.equity)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isEquityPositive ? "bg-emerald-500" : "bg-destructive"
                )}
                style={{
                  width: `${Math.min(
                    100,
                    (Math.abs(acc.equity) / Math.max(acc.totalInvested + acc.laborValue, 1)) * 100
                  )}%`,
                }}
              />
            </div>
            {!hasMarketPrice && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Set market price in Settings to see current market value.
              </p>
            )}
          </div>
        )}

        {/* Labor vesting */}
        {p.partner_type !== "capital" &&
          p.labor_value_monthly &&
          p.labor_value_monthly > 0 && (
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  Labor Vesting
                </span>
                {acc.months >= (p.cliff_months ?? 0) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ {acc.months} months vested
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ⏳ Cliff: {acc.months}/{p.cliff_months ?? 0} months
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                ৳{p.labor_value_monthly.toLocaleString("en-IN")}/month ×{" "}
                {acc.months >= (p.cliff_months ?? 0) ? acc.months : 0} months ={" "}
                <span className="font-semibold text-foreground">
                  {bdt(acc.laborValue)}
                </span>
              </div>
              {(p.cliff_months ?? 0) > 0 && acc.months < (p.cliff_months ?? 0) && (
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{
                      width: `${Math.min(100, (acc.months / (p.cliff_months ?? 1)) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
      </div>

      {/* ── Capital Timeline Chart ───────────────────────────────────── */}
      {withBalance.length >= 2 && (
        <div className="rounded-xl bg-card border border-border shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Capital Balance Over Time
            </h3>
            {withBalance.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                Latest: {bdt(withBalance[withBalance.length - 1].balance)}
              </span>
            )}
          </div>
          <CapitalTimelineChart
            data={withBalance.map((t) => ({
              date: t.recorded_at,
              balance: t.balance,
            }))}
          />
        </div>
      )}

      {/* ── Transaction Ledger ───────────────────────────────────────── */}
      <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Transaction History</h3>
            <Link
              href={`/dashboard/partners/${p.id}/statement`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-2.5 py-1 transition-colors"
              title="Print Statement of Account"
            >
              <FileText className="h-3.5 w-3.5" />
              Statement
            </Link>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {transactions.length} record{transactions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="px-5 py-3 border-b border-border/40 flex gap-1.5 overflow-x-auto scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors",
                filter === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold",
                    filter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Wallet className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    Balance
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    Notes
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((txn, idx) => {
                  const meta = TXN_META[txn.type];
                  const Icon = TXN_ICON[txn.type];
                  return (
                    <tr
                      key={txn.id}
                      className={cn(
                        "transition-colors hover:bg-muted/20 group",
                        idx === 0 && "bg-muted/10"
                      )}
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDate(txn.recorded_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                              meta.bgCls
                            )}
                          >
                            <Icon
                              className={cn("h-3.5 w-3.5", meta.textCls)}
                            />
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium whitespace-nowrap",
                              meta.textCls
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        <span className={meta.textCls}>
                          {meta.sign}
                          {bdt(txn.amount)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold tabular-nums whitespace-nowrap hidden sm:table-cell">
                        {txn.balance >= 0 ? "" : "−"}
                        {bdt(txn.balance)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                        {txn.notes ?? "—"}
                      </td>
                      <td className="pr-3 py-3.5">
                        {confirmTxnId === txn.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteTxn(txn.id)}
                              disabled={deletingTxnId === txn.id}
                              className="text-[11px] font-bold text-destructive hover:underline disabled:opacity-50"
                            >
                              {deletingTxnId === txn.id ? "…" : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmTxnId(null)}
                              className="text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmTxnId(txn.id)}
                            className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="bg-muted/30 border-t-2 border-border/60">
                  <td
                    colSpan={2}
                    className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  >
                    Summary
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="space-y-0.5">
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                        +
                        {bdt(
                          transactions
                            .filter(
                              (t) =>
                                t.type === "investment" || t.type === "profit"
                            )
                            .reduce((s, t) => s + t.amount, 0)
                        )}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400 font-semibold tabular-nums">
                        −
                        {bdt(
                          transactions
                            .filter(
                              (t) =>
                                t.type === "withdrawal" ||
                                t.type === "loss_allocation"
                            )
                            .reduce((s, t) => s + t.amount, 0)
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums hidden sm:table-cell">
                    {withBalance.length > 0 && (
                      <>
                        {withBalance[withBalance.length - 1].balance >= 0
                          ? ""
                          : "−"}
                        {bdt(
                          withBalance.length > 0
                            ? withBalance[withBalance.length - 1].balance
                            : 0
                        )}
                      </>
                    )}
                  </td>
                  <td className="hidden md:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Transaction Modal ──────────────────────────────────────── */}
      <Dialog open={addTxnOpen} onOpenChange={setAddTxnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Transaction — {p.name}</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("partner_id", p.id);
              fd.set("type", txnType);
              txnAction(fd);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Transaction Type</Label>
              <Select
                value={txnType}
                onValueChange={(v) =>
                  setTxnType(v as "investment" | "withdrawal")
                }
              >
                <SelectTrigger>
                  <span className="truncate">
                    {txnType === "investment"
                      ? "Capital In (Investment)"
                      : "Capital Out (Withdrawal)"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investment">
                    Capital In (Investment)
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    Capital Out (Withdrawal)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (৳)</Label>
                <Input
                  name="amount"
                  type="number"
                  min="1"
                  step="any"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  name="recorded_at"
                  type="date"
                  max={today}
                  defaultValue={today}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                name="notes"
                maxLength={500}
                placeholder="Cash, bank transfer, cheque..."
                rows={2}
              />
            </div>
            {txnState?.error && (
              <p className="text-sm text-destructive">{txnState.error}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddTxnOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={txnPending}>
                {txnPending
                  ? "Saving..."
                  : txnType === "investment"
                  ? "Record Investment"
                  : "Record Withdrawal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Partner Modal ─────────────────────────────────────────── */}
      {editOpen && (
        <EditModal
          partner={p}
          totalInvested={acc.totalInvested}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({
  partner: p,
  totalInvested,
  onClose,
}: {
  partner: Partner;
  totalInvested: number;
  onClose: () => void;
}) {
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>(
    p.partner_type ?? "capital"
  );
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">(
    p.share_mode ?? "auto"
  );
  const [bearsLossField, setBearsLossField] = useState(p.bears_loss ?? true);
  const [state, action, pending] = useActionState(updatePartner, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Partner updated");
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Partner — {p.name}</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => {
            fd.set("partner_id", p.id);
            fd.set("partner_type", partnerTypeField);
            fd.set("share_mode", shareModeField);
            action(fd);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input name="name" required defaultValue={p.name} />
          </div>

          <div className="space-y-1.5">
            <Label>Partner Type</Label>
            <Select
              value={partnerTypeField}
              onValueChange={(v) => {
                const type = v as PartnerType;
                setPartnerTypeField(type);
                if (type === "labor") setShareModeField("manual");
                else if (type === "capital") setShareModeField("auto");
              }}
            >
              <SelectTrigger>
                <span className="truncate">
                  {partnerTypeField === "capital" && "Capital Partner"}
                  {partnerTypeField === "labor" && "Labor Partner"}
                  {partnerTypeField === "hybrid" && "Capital + Labor"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">Capital Partner</SelectItem>
                <SelectItem value="labor">Labor Partner</SelectItem>
                <SelectItem value="hybrid">Capital + Labor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {partnerTypeField !== "labor" && (
            <div className="space-y-1.5">
              <Label>Capital (৳)</Label>
              <Input
                name="investment_amount"
                type="number"
                min="0"
                step="100"
                defaultValue={totalInvested}
              />
              <p className="text-xs text-muted-foreground">
                Use the Capital Ledger to add additional transactions.
              </p>
            </div>
          )}

          {partnerTypeField !== "capital" && (
            <>
              <div className="space-y-1.5">
                <Label>Monthly Labor Value (৳)</Label>
                <Input
                  name="labor_value_monthly"
                  type="number"
                  min="0"
                  step="500"
                  defaultValue={p.labor_value_monthly ?? 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cliff Period (months)</Label>
                <Input
                  name="cliff_months"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={p.cliff_months ?? 0}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Share Mode</Label>
            <div className="flex gap-2">
              {(["auto", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setShareModeField(mode)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-colors",
                    shareModeField === mode
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "auto" ? "Auto (Ratio-Based)" : "Manual %"}
                </button>
              ))}
            </div>
          </div>

          {shareModeField === "manual" && (
            <div className="space-y-1.5">
              <Label>Profit Share (%)</Label>
              <Input
                name="profit_share_pct"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={p.profit_share_pct}
              />
            </div>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Bears Capital Loss</p>
                <p className="text-xs text-muted-foreground">
                  Participates in business losses
                </p>
              </div>
              <input
                type="checkbox"
                name="bears_loss"
                value="true"
                checked={bearsLossField}
                onChange={(e) => setBearsLossField(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Join Date</Label>
            <Input name="joined_at" type="date" defaultValue={p.joined_at} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              name="notes"
              rows={2}
              maxLength={500}
              defaultValue={p.notes ?? ""}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── CapitalTimelineChart ──────────────────────────────────────────────────────

function CapitalTimelineChart({
  data,
}: {
  data: { date: string; balance: number }[];
}) {
  const chartData = data.map((d) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    balance: Math.round(d.balance),
  }));

  const maxVal = Math.max(...chartData.map((d) => d.balance));
  const isPositive = chartData[chartData.length - 1]?.balance >= 0;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={chartData}
        margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis hide domain={[0, maxVal * 1.1]} />
        <Tooltip
          formatter={(v) => [
            `৳${Number(v ?? 0).toLocaleString("en-IN")}`,
            "Balance",
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={strokeColor}
          strokeWidth={2}
          fill="url(#capGrad)"
          dot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── KpiTile ───────────────────────────────────────────────────────────────────

function ProfileStatCard({
  icon: Icon,
  label,
  value,
  iconCls,
  valueColor,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconCls: string;
  valueColor?: "green" | "red";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
      </div>
      <p className={cn(
        "text-xl font-bold tabular-nums tracking-tight truncate",
        valueColor === "green"
          ? "text-emerald-600 dark:text-emerald-400"
          : valueColor === "red"
          ? "text-destructive"
          : "text-foreground"
      )}>
        {value}
      </p>
      {sub && (
        <p className={cn(
          "mt-1 text-xs font-medium",
          sub.startsWith("ROI: +") ? "text-emerald-600 dark:text-emerald-400" :
          sub.startsWith("ROI: −") || sub.startsWith("ROI: -") ? "text-destructive" :
          "text-muted-foreground"
        )}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── PositionTile ──────────────────────────────────────────────────────────────

const POSITION_STYLES: Record<
  string,
  string
> = {
  blue: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40",
  amber:
    "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40",
  red: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40",
  violet:
    "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40",
  orange:
    "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40",
  emerald:
    "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40",
};

function PositionTile({
  label,
  value,
  sign,
  colorKey,
  icon,
  pending,
}: {
  label: string;
  value: number;
  sign: "+" | "−";
  colorKey: string;
  icon?: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        POSITION_STYLES[colorKey] ?? POSITION_STYLES.blue,
        pending && "border-dashed"
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wide opacity-70 leading-none">
          {label}
          {pending && (
            <span className="ml-1 opacity-60">(pending)</span>
          )}
        </p>
      </div>
      <p className="text-sm font-bold tabular-nums">
        {sign}
        {bdt(value)}
      </p>
    </div>
  );
}
