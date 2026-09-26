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
  X,
  FileText,
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
import { CapitalTimelineChart } from "@/components/partners/CapitalTimelineChart";
import { EditPartnerProfileModal } from "@/components/partners/modals/EditPartnerProfileModal";
import { useL } from "@/i18n/text";
import { partnerTxnLabel, partnerTypeLabel } from "@/lib/partners/labels";
import { Tr } from "@/i18n/Tr";
import { useTranslation } from "@/i18n/I18nProvider";
import { todayDhaka } from "@/lib/dates";
import type { PartnerPosition } from "@/lib/partners/position";
import { ShareRulesPanel } from "@/components/partners/ShareRulesPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type TxnFilter = "all" | "investment" | "withdrawal" | "profit" | "loss_allocation";

/** The farm figures this partner's shares come from (lib/partners/position.ts). */
export type ProfileFarm = { realized: number; estimate: number; total: number; soldCount: number; marketPricePerKg: number | null; herdValued: boolean };

interface Props {
  partner: Partner;
  transactions: PartnerTransaction[];
  position: PartnerPosition;
  farm: ProfileFarm;
  /** everything the share-rule panel needs (lib/partners/load-positions.ts) */
  shareRules: Omit<React.ComponentProps<typeof ShareRulesPanel>, "today">;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

function fmtDate(d: string) {
  return d.slice(0, 10);
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
  position: pos,
  farm,
  shareRules,
}: Props) {
  const L = useL();
  const { locale } = useTranslation();
  const router = useRouter();
  const today = todayDhaka();

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
      toast.success(L("লেনদেন সেভ হলো", "Transaction saved"));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddTxnOpen(false);
    }
    if (txnState?.error) toast.error(txnState.error);
  }, [txnState, L]);

  // Build running balance (oldest → newest), display newest first
  const chronological = [...transactions].sort(
    (a, b) =>
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const withBalance = chronological.reduce(
    (arr, txn) => {
      const last = arr.length > 0 ? arr[arr.length - 1].balance : 0;
      // capital only: a profit payout or a loss record is not capital put in or taken out
      const delta = txn.type === "investment" ? txn.amount : txn.type === "withdrawal" ? -txn.amount : 0;
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
    { key: "all", label: L("সব", "All"), count: filterCounts.all },
    {
      key: "investment",
      label: L("জমা", "Investments"),
      count: filterCounts.investment,
    },
    {
      key: "withdrawal",
      label: L("তোলা", "Withdrawals"),
      count: filterCounts.withdrawal,
    },
    {
      key: "profit",
      label: L("লাভ/ক্ষতির ভাগ", "Distributions"),
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
  const months = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(p.joined_at).slice(0, 10)}T00:00:00Z`)) / (30.44 * 86400000)));
  const share = pos.realizedShare + pos.estimateShare;

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePartner(p.id);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(L(`${p.name} সরানো হলো`, `${p.name} removed`));
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
    else toast.success(L("লেনদেন মুছে ফেলা হলো", "Transaction deleted"));
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
                      {partnerTypeLabel(p.partner_type, locale)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      {L(`লাভের ${pos.profitPct.toFixed(1)}%`, `${pos.profitPct.toFixed(1)}% of profit`)}
                    </span>
                    {pos.distributable > 0.5 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Clock className="h-3 w-3" />
                        {L("লাভ পাওনা", "Profit due")}: {bdt(pos.distributable)}
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
                    <span className="hidden sm:inline">{L("লেনদেন যোগ", "Add transaction")}</span>
                    <span className="sm:hidden">{L("যোগ", "Add")}</span>
                  </button>
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={L("বদলান", "Edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm ? (
                    <div className="flex items-center gap-1.5 text-xs border border-destructive/30 rounded-lg px-2.5 py-1.5 bg-destructive/5">
                      <span className="text-destructive font-medium">{L("মুছবেন?", "Delete?")}</span>
                      <button onClick={handleDelete} disabled={isDeleting} className="text-destructive font-bold hover:underline">{L("হ্যাঁ", "Yes")}</button>
                      <button onClick={() => setDeleteConfirm(false)} className="text-muted-foreground hover:underline">{L("না", "No")}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                      title={L("মুছুন", "Delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-sm text-muted-foreground">
                <span>{L("যোগ দিয়েছেন", "Joined")} {fmtDate(p.joined_at)}</span>
                <span>·</span>
                <span>{L(`${months} মাস ধরে`, `${months} month${months !== 1 ? "s" : ""} active`)}</span>
                {pos.leftAt && (
                  <><span>·</span><span className="font-medium text-muted-foreground">{L(`${pos.leftAt} থেকে অবসর`, `retired ${pos.leftAt}`)}</span></>
                )}
                {!pos.terms.bearsLoss && p.partner_type !== "labor" && (
                  <><span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{L("ক্ষতির ভাগ নেই", "No loss sharing")}</span></>
                )}
                {pos.terms.shareMode === "manual" && (
                  <><span>·</span><span>{L("নির্দিষ্ট ভাগ", "Fixed share")}</span></>
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

      {/* ── Position (lib/partners/position.ts — the same figures as the partners page) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProfileStatCard icon={Banknote} label={L("খাটানো মূলধন", "Capital in")} value={bdt(pos.netCapital + pos.laborValue)}
          iconCls="text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
          sub={pos.capitalOut > 0 ? L(`জমা ${bdt(pos.capitalIn)} − তোলা ${bdt(pos.capitalOut)}`, `in ${bdt(pos.capitalIn)} − out ${bdt(pos.capitalOut)}`) : undefined} />
        <ProfileStatCard icon={Layers} label={L("লাভের ভাগ", "Share of profit")} value={`${pos.profitPct.toFixed(1)}%`}
          iconCls="text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30"
          sub={pos.terms.bearsLoss ? L(`ক্ষতির ভাগ ${pos.lossPct.toFixed(1)}%`, `loss share ${pos.lossPct.toFixed(1)}%`) : L("ক্ষতির ভাগ নেই", "bears no loss")} />
        <ProfileStatCard icon={share >= 0 ? TrendingUp : TrendingDown} label={L("আজ বিক্রি করলে ভাগ", "Share if sold today")}
          value={(share >= 0 ? "+" : "−") + bdt(share)} valueColor={share >= 0 ? "green" : "red"}
          iconCls={share >= 0 ? "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" : "text-destructive bg-red-100 dark:bg-red-900/30"}
          sub={L(`পাকা ${pos.realizedShare >= 0 ? "+" : "−"}${bdt(pos.realizedShare)} · আনুমানিক ${pos.estimateShare >= 0 ? "+" : "−"}${bdt(pos.estimateShare)}`,
                 `final ${pos.realizedShare >= 0 ? "+" : "−"}${bdt(pos.realizedShare)} · estimate ${pos.estimateShare >= 0 ? "+" : "−"}${bdt(pos.estimateShare)}`)} />
        <ProfileStatCard icon={Wallet} label={L("মোট পাওনা", "Account value")} value={bdt(pos.balance)}
          iconCls="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
          sub={pos.profitReceived > 0 ? L(`লাভ পেয়েছেন ${bdt(pos.profitReceived)}`, `profit paid ${bdt(pos.profitReceived)}`) : undefined} />
      </div>

      <div className="rounded-xl bg-card border border-border shadow-card p-5 space-y-3 text-sm">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" />{L("হিসাব কীভাবে", "How it is worked out")}</h3>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <Line label={L("জমা", "Put in")} value={`+${bdt(pos.capitalIn)}`} />
          {pos.capitalOut > 0 && <Line label={L("তোলা", "Taken out")} value={`−${bdt(pos.capitalOut)}`} />}
          {pos.laborValue > 0 && <Line label={L("শ্রমের মূল্য", "Labour value")} value={`+${bdt(pos.laborValue)}`} />}
          <Line label={L("পাকা লাভ/ক্ষতির ভাগ (বিক্রি হওয়া গরু)", "Share of final result (animals sold)")} value={`${pos.realizedShare >= 0 ? "+" : "−"}${bdt(pos.realizedShare)}`} />
          <Line label={L("আনুমানিক ভাগ (খামারে থাকা গরু)", "Estimated share (animals on the farm)")} value={`${pos.estimateShare >= 0 ? "+" : "−"}${bdt(pos.estimateShare)}`} />
          {pos.profitReceived > 0 && <Line label={L("লাভ পেয়ে গেছেন", "Profit already paid")} value={`−${bdt(pos.profitReceived)}`} />}
          <Line label={L("মোট পাওনা", "Account value")} value={bdt(pos.balance)} strong />
        </div>
        <p className="text-xs text-muted-foreground">
          {farm.soldCount === 0
            ? L("এখনো কোনো গরু বিক্রি হয়নি — তাই পাকা লাভ বা ক্ষতি নেই। আনুমানিক ভাগ বাজারদর ও ওজনের সাথে বদলায়।", "No animal has been sold yet — so there is no final profit or loss. The estimate moves with price and weight.")
            : L("শুধু পাকা লাভের ভাগ বণ্টন করা যায়।", "Only the share of final profit can be paid out.")}
          {" "}{pos.terms.shareMode === "manual"
            ? L(`নির্দিষ্ট ভাগ: লাভের ${pos.profitPct.toFixed(1)}%।`, `Fixed share: ${pos.profitPct.toFixed(1)}% of profit.`)
            : L(`ভাগ টাকা × দিন অনুপাতে (${Math.round(pos.capitalDays).toLocaleString("en-IN")} টাকা-দিন)।`, `Share by taka × days (${Math.round(pos.capitalDays).toLocaleString("en-IN")} taka-days).`)}
        </p>
        {!farm.herdValued && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{L("কিছু গরুর দাম জানা নেই — টাকা-পয়সা পাতায় বাজারদর দিন ও গরু ওজন করুন।", "Some animals have no value yet — enter the market price and weigh the cattle.")}</p>
        )}
      </div>

      {pos.overpaid > 0.5 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {L(`পাকা লাভের ভাগের চেয়ে ${bdt(pos.overpaid)} বেশি দেওয়া হয়ে গেছে (পরে কোনো খরচ বা বিক্রি সংশোধনের কারণে)। পরের বণ্টনে এটা কাটা যাবে।`,
             `${bdt(pos.overpaid)} more than the realized share has been paid (a later correction to a cost or a sale). It comes off the next payout.`)}
        </p>
      )}

      {/* ── Share rules over time ── */}
      <ShareRulesPanel {...shareRules} today={today} />

      {/* ── Capital Timeline Chart ───────────────────────────────────── */}
      {withBalance.length >= 2 && (
        <div className="rounded-xl bg-card border border-border shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              {L("সময়ের সাথে মূলধন", "Capital Balance Over Time")}
            </h3>
            {withBalance.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {L("সর্বশেষ", "Latest")}: {bdt(withBalance[withBalance.length - 1].balance)}
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
            <h3 className="text-sm font-semibold">{L("লেনদেনের তালিকা", "Transaction History")}</h3>
            <Link
              href={`/dashboard/partners/${p.id}/statement`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-2.5 py-1 transition-colors"
              title={L("হিসাব বিবরণী প্রিন্ট", "Print Statement of Account")}
            >
              <FileText className="h-3.5 w-3.5" />
              {L("বিবরণী", "Statement")}
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
            <p className="text-sm text-muted-foreground">{L("কোনো লেনদেন নেই", "No transactions found")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/40">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {L("তারিখ", "Date")}
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {L("ধরন", "Type")}
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {L("টাকা", "Amount")}
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                    {L("ব্যালেন্স", "Balance")}
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                    {L("নোট", "Notes")}
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
                            {partnerTxnLabel(txn.type, locale)}
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
                              {deletingTxnId === txn.id ? "…" : L("হ্যাঁ", "Yes")}
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
                    {L("সারসংক্ষেপ", "Summary")}
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
              <Label>{L("লেনদেনের ধরন", "Transaction Type")}</Label>
              <Select
                value={txnType}
                onValueChange={(v) =>
                  setTxnType(v as "investment" | "withdrawal")
                }
              >
                <SelectTrigger>
                  <span className="truncate">
                    {txnType === "investment"
                      ? L("মূলধন জমা", "Capital in (investment)")
                      : L("টাকা তোলা", "Capital out (withdrawal)")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investment">
                    {L("মূলধন জমা", "Capital In (Investment)")}
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    {L("টাকা তোলা", "Capital Out (Withdrawal)")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{L("টাকা (৳)", "Amount (৳)")}</Label>
                <Input
                  name="amount"
                  type="number"
                  min="1"
                  step="any"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{L("তারিখ", "Date")}</Label>
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
              <Label>{L("নোট (ঐচ্ছিক)", "Notes (optional)")}</Label>
              <Textarea
                name="notes"
                maxLength={500}
                placeholder={L("নগদ, ব্যাংক, চেক…", "Cash, bank transfer, cheque...")}
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
                {L("বাতিল", "Cancel")}
              </Button>
              <Button type="submit" disabled={txnPending}>
                {txnPending
                  ? L("সেভ হচ্ছে…", "Saving…")
                  : txnType === "investment"
                  ? L("জমা সেভ করুন", "Record investment")
                  : L("তোলা সেভ করুন", "Record withdrawal")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Partner Modal ─────────────────────────────────────────── */}
      {editOpen && (
        <EditPartnerProfileModal
          partner={p}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}







function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "border-t border-border/60 pt-1.5 font-semibold sm:col-span-2")}>
      <span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value}</span>
    </div>
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
            <span className="ml-1 opacity-60"><Tr bn="(বাকি)" en="(pending)" /></span>
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
