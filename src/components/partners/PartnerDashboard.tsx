"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  Banknote,
  Wrench,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Layers,
  ChevronRight,
  Wallet,
} from "lucide-react";
import Link from "next/link";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createPartner,
  updatePartner,
  addPartnerTransaction,
  deletePartner,
  declareDistribution,
} from "@/app/dashboard/(app)/partners/actions";
import {
  PartnerEquityChart,
  type EquityEntry,
} from "@/components/partners/PartnerEquityChart";
import type {
  Partner,
  PartnerTransaction,
  PartnerTransactionType,
  PartnerType,
} from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function bdt(n: number) {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

const AVATAR_PAL = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-600",
  "bg-amber-500", "bg-rose-500", "bg-cyan-600",
  "bg-indigo-500", "bg-pink-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_PAL[h % AVATAR_PAL.length];
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function monthsActive(joinedAt: string): number {
  const joined = new Date(joinedAt + "T00:00:00");
  const now = new Date();
  let months =
    (now.getFullYear() - joined.getFullYear()) * 12 +
    (now.getMonth() - joined.getMonth());
  if (now.getDate() < joined.getDate()) months--;
  return Math.max(0, months);
}

/** Total capital invested by a partner = sum of ALL investment transactions.
 *  Transactions are the single source of truth; investment_amount is a display-only reference. */
function totalCapitalOf(txns: PartnerTransaction[]): number {
  return txns
    .filter((t) => t.type === "investment")
    .reduce((s, t) => s + t.amount, 0);
}

/** Net Investment a partner holds: capital invested - withdrawn + vested labor value. */
function computeNetInvestment(p: Partner, txns: PartnerTransaction[]): number {
  const invested = totalCapitalOf(txns);
  const withdrawn = txns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);

  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue = p.labor_value_monthly
    ? (p.labor_value_monthly * vestedMonths)
    : 0;
    
  return Math.max(0, invested - withdrawn + laborValue);
}

/** Effective share %:
 *  - manual partners get their fixed profit_share_pct
 *  - auto partners proportionally split whatever % remains after manual partners
 *    (so total across all partners always sums to 100%) */
function effectiveShare(
  p: Partner,
  allPartners: Partner[],
  txnsByPartner: Record<string, PartnerTransaction[]>
): number {
  if (p.share_mode === "manual") return p.profit_share_pct;

  const manualTotal = allPartners
    .filter((x) => x.share_mode === "manual")
    .reduce((s, x) => s + x.profit_share_pct, 0);
  const remainingPool = Math.max(0, 100 - manualTotal);

  const autoPartners = allPartners.filter((x) => x.share_mode !== "manual");
  const totalAutoInvested = autoPartners.reduce(
    (s, x) => s + computeNetInvestment(x, txnsByPartner[x.id] ?? []),
    0
  );
  if (totalAutoInvested === 0) return 0;

  return (computeNetInvestment(p, txnsByPartner[p.id] ?? []) / totalAutoInvested) * remainingPool;
}

/** Full capital-account summary for one partner. */
function computeAccount(
  p: Partner,
  txns: PartnerTransaction[],
  netPL: number,
  sharePct: number
) {
  const totalInvested = totalCapitalOf(txns);
  const withdrawn = txns
    .filter((t) => t.type === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const profitReceived = txns
    .filter((t) => t.type === "profit")
    .reduce((s, t) => s + t.amount, 0);
  const lossBorne = txns
    .filter((t) => t.type === "loss_allocation")
    .reduce((s, t) => s + t.amount, 0);

  const months = monthsActive(p.joined_at);
  const cliff = p.cliff_months ?? 0;
  const vestedMonths = months >= cliff ? months : 0;
  const laborValue =
    p.partner_type !== "capital" && p.labor_value_monthly
      ? p.labor_value_monthly * vestedMonths
      : 0;

  const pendingProfit =
    netPL > 0 && sharePct > 0
      ? Math.max(0, (netPL * sharePct) / 100 - profitReceived)
      : 0;
  const pendingLoss =
    netPL < 0 && sharePct > 0 && p.bears_loss
      ? Math.max(0, (Math.abs(netPL) * sharePct) / 100 - lossBorne)
      : 0;

  const equity = totalInvested + laborValue - withdrawn - lossBorne + pendingProfit - pendingLoss;

  return { totalInvested, withdrawn, profitReceived, lossBorne, laborValue, months, equity, pendingProfit, pendingLoss };
}

// ── Icon / label maps ─────────────────────────────────────────────────────────

const TXN_LABEL = (t: Dictionary): Record<PartnerTransactionType, string> => ({
  investment: t.partners.investment,
  withdrawal: t.partners.withdrawal,
  profit: t.partners.profit,
  loss_allocation: t.partners.loss_allocation,
});

const TXN_ICON: Record<PartnerTransactionType, React.ReactNode> = {
  investment: <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />,
  withdrawal: <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />,
  profit: <Banknote className="h-3.5 w-3.5 text-violet-500" />,
  loss_allocation: <TrendingDown className="h-3.5 w-3.5 text-orange-500" />,
};

const TXN_TEXT: Record<PartnerTransactionType, string> = {
  investment: "text-emerald-600 dark:text-emerald-400",
  withdrawal: "text-red-600 dark:text-red-400",
  profit: "text-violet-600 dark:text-violet-400",
  loss_allocation: "text-orange-600 dark:text-orange-400",
};

const TXN_SIGN: Record<PartnerTransactionType, "+" | "−"> = {
  investment: "+", withdrawal: "−", profit: "+", loss_allocation: "−",
};

const TYPE_CONFIG: Record<
  PartnerType,
  { icon: React.ReactNode; cls: string; label: (t: Dictionary) => string }
> = {
  capital: {
    icon: <Banknote className="h-3 w-3" />,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    label: (t) => t.partners.capital_badge,
  },
  labor: {
    icon: <Wrench className="h-3 w-3" />,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    label: (t) => t.partners.labor_badge,
  },
  hybrid: {
    icon: <TrendingUp className="h-3 w-3" />,
    cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    label: (t) => t.partners.hybrid_badge,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type CattleValuation = {
  activeCattleCount: number;
  marketPricePerKg: number;
  marketPriceDate: string | null;
  totalEstimatedValue: number;
  totalActiveCostBasis: number;
  totalUnrealizedGain: number;
  hasMarketPrice: boolean;
  rows: Array<{
    id: string;
    daysInPen: number;
    estimatedWeight: number;
    weightSource: "weighed" | "estimated";
    estimatedMarketValue: number;
    costBasis: number;
    unrealizedGain: number;
  }>;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  partners: Partner[];
  txnsByPartner: Record<string, PartnerTransaction[]>;
  netPL: number;
  mgmtFeeRate?: number;
  cattleValuation: CattleValuation;
  totalAssetValue?: number;
}

// ── PartnerDashboard ──────────────────────────────────────────────────────────

export function PartnerDashboard({
  partners,
  txnsByPartner,
  netPL,
  mgmtFeeRate = 0,
  cattleValuation,
  totalAssetValue = 0,
}: Props) {
  const { t } = useTranslation();

  const [addOpen, setAddOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>("capital");
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">("auto");
  const [bearsLossField, setBearsLossField] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [txnType, setTxnType] = useState<"investment" | "withdrawal">("investment");

  // ── Valuation calculator state ─────────────────────────────────
  const [newInvestmentAmt, setNewInvestmentAmt] = useState("");

  // Management fee must be computed before preMoneyValuation uses netPLAfterFee
  const mgmtFeeAmountEarly = netPL > 0 ? (netPL * mgmtFeeRate) / 100 : 0;
  const netPLAfterFeeEarly = netPL - mgmtFeeAmountEarly;

  // Pre-money valuation: total partner capital + undistributed P&L + cattle value + assets
  const totalPartnerCapital = partners.reduce((s, p) => {
    const txns = txnsByPartner[p.id] ?? [];
    const invested   = txns.filter(t => t.type === "investment").reduce((a, t) => a + t.amount, 0);
    const withdrawn  = txns.filter(t => t.type === "withdrawal").reduce((a, t) => a + t.amount, 0);
    return s + invested - withdrawn;
  }, 0);
  const cattleMarketValue = cattleValuation.hasMarketPrice ? cattleValuation.totalEstimatedValue : cattleValuation.totalActiveCostBasis;
  const preMoneyValuation = Math.max(0, totalPartnerCapital + netPLAfterFeeEarly + cattleMarketValue + totalAssetValue);

  const newInvNum     = parseFloat(newInvestmentAmt) || 0;
  const postMoney     = preMoneyValuation + newInvNum;
  const suggestedPct  = postMoney > 0 && newInvNum > 0 ? (newInvNum / postMoney) * 100 : 0;

  const [addState, addAction, addPending] = useActionState(createPartner, undefined);
  const [txnState, txnAction, txnPending] = useActionState(addPartnerTransaction, undefined);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (addState?.success) {
      setTimeout(() => {
        toast.success("Partner added");
        setAddOpen(false);
        setPartnerTypeField("capital");
        setShareModeField("auto");
      }, 0);
    }
  }, [addState]);

  useEffect(() => {
    if (txnState?.success) {
      setTimeout(() => {
        toast.success("Transaction saved");
        setTxnOpen(false);
        setSelectedPartnerId("");
        setTxnType("investment");
      }, 0);
    }
  }, [txnState]);

  // ── Aggregate stats ───────────────────────────────────────────────────────────
  const totalCapital = partners.reduce((s, p) => {
    if (p.partner_type === "labor") return s;
    const txns = txnsByPartner[p.id] ?? [];
    const withdrawn = txns
      .filter((tx) => tx.type === "withdrawal")
      .reduce((a, tx) => a + tx.amount, 0);
    return s + totalCapitalOf(txns) - withdrawn;
  }, 0);

  const mgmtFeeAmount = mgmtFeeAmountEarly;
  const netPLAfterFee = netPLAfterFeeEarly;

  const totalInvested = partners.reduce(
    (s, p) => s + computeNetInvestment(p, txnsByPartner[p.id] ?? []),
    0
  );

  const accounts = partners.map((p) => {
    const txns = txnsByPartner[p.id] ?? [];
    const sharePct = effectiveShare(p, partners, txnsByPartner);
    // entry_netpl isolates profit: new partner only shares P&L earned AFTER joining.
    // Founding partners have null entry_netpl → treated as 0 → share all history.
    const netPLForPartner = netPLAfterFee - (p.entry_netpl ?? 0);
    return {
      partner: p,
      sharePct,
      acc: computeAccount(p, txns, netPLForPartner, sharePct),
    };
  });

  const totalEquity = accounts.reduce((s, { acc }) => s + acc.equity, 0);
  const totalBusinessValue = totalEquity + (cattleValuation.hasMarketPrice ? cattleValuation.totalUnrealizedGain : 0);

  const pendingAccounts = accounts.filter(
    ({ acc }) => acc.pendingProfit + acc.pendingLoss > 0
  );
  const totalPendingAmount = pendingAccounts.reduce(
    (s, { acc }) => s + acc.pendingProfit + acc.pendingLoss,
    0
  );

  const manualShareTotal = accounts
    .filter(({ partner: p }) => p.share_mode === "manual")
    .reduce((s, { sharePct }) => s + sharePct, 0);
  const hasAutoPartners = partners.some((p) => p.share_mode !== "manual");
  const shareWarning =
    manualShareTotal > 100 ||
    (manualShareTotal === 100 && hasAutoPartners);

  const isLoss = netPL < 0;

  // Cross-partner recent activity
  const nameById = Object.fromEntries(partners.map((p) => [p.id, p.name]));
  const allRecentTxns = Object.entries(txnsByPartner)
    .flatMap(([pid, txns]) =>
      txns.map((t) => ({ ...t, partnerName: nameById[pid] ?? "Unknown" }))
    )
    .sort(
      (a, b) =>
        new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* ── Overview stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={Users}
          label={t.partners.total_partners}
          value={partners.length.toString()}
          iconCls="text-primary bg-primary/10"
        />
        <SummaryCard
          icon={Banknote}
          label="Capital Deployed"
          value={bdt(totalCapital)}
          iconCls="text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30"
        />
        <SummaryCard
          icon={netPL >= 0 ? TrendingUp : TrendingDown}
          label={t.partners.net_pl}
          value={(netPL >= 0 ? "+" : "−") + bdt(netPL)}
          valueColor={netPL > 0 ? "green" : netPL < 0 ? "red" : undefined}
          iconCls={
            netPL >= 0
              ? "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30"
              : "text-destructive bg-red-100 dark:bg-red-900/30"
          }
        />
        <SummaryCard
          icon={Wallet}
          label={t.partners.equity}
          value={(totalEquity >= 0 ? "" : "−") + bdt(totalEquity)}
          valueColor={totalEquity >= 0 ? "green" : "red"}
          iconCls="text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30"
        />
      </div>

      {/* ── Management fee info ──────────────────────────────────────── */}
      {mgmtFeeRate > 0 && netPL > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">Management Fee ({mgmtFeeRate}%)</span>
            <span className="text-muted-foreground hidden sm:inline">— deducted before partner profit split</span>
          </div>
          <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {bdt(mgmtFeeAmount)}
          </span>
        </div>
      )}

      {/* ── Manual-share overflow warning ───────────────────────────── */}
      {shareWarning && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-destructive">
          {manualShareTotal > 100
            ? t.partners.share_warning.replace("{{pct}}", manualShareTotal.toFixed(1))
            : `⚠️ Manual shares = 100% — auto partners will receive 0% profit share.`}
        </div>
      )}

      {/* ── Pending-distribution banner ──────────────────────────────── */}
      {partners.length > 0 && totalPendingAmount > 0 && !isLoss && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
            isLoss
              ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isLoss ? (
              <AlertCircle className="h-4 w-4 text-orange-600 shrink-0" />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {isLoss ? t.partners.unallocated_loss : t.partners.undistributed_profit}
              </p>
              <p className="text-xs text-muted-foreground">
                {bdt(totalPendingAmount)} · {pendingAccounts.length} partner
                {pendingAccounts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setDistOpen(true)}>
            {t.partners.declare_distribution}
          </Button>
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Add Partner */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="h-4 w-4" />
            {t.partners.add_partner}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t.partners.new_partner}</DialogTitle>
            </DialogHeader>
            <form
              action={(fd) => {
                fd.set("partner_type", partnerTypeField);
                fd.set("share_mode", shareModeField);
                fd.set("entry_netpl",     String(netPLAfterFee));
                fd.set("entry_valuation", String(preMoneyValuation));
                addAction(fd);
              }}
              className="space-y-4"
            >
              {/* Valuation Calculator */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                  Business Valuation
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Partner capital</span>
                  <span className="text-right tabular-nums font-medium">{bdt(totalPartnerCapital)}</span>
                  <span className="text-muted-foreground">Undistributed P&amp;L</span>
                  <span className={cn("text-right tabular-nums font-medium", netPLAfterFee >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                    {netPLAfterFee >= 0 ? "+" : "−"}{bdt(netPLAfterFee)}
                  </span>
                  <span className="text-muted-foreground">Cattle value</span>
                  <span className="text-right tabular-nums font-medium">{bdt(cattleMarketValue)}</span>
                  {totalAssetValue > 0 && <>
                    <span className="text-muted-foreground">Fixed assets</span>
                    <span className="text-right tabular-nums font-medium">{bdt(totalAssetValue)}</span>
                  </>}
                  <span className="font-semibold text-amber-800 dark:text-amber-300 border-t border-amber-200 dark:border-amber-700 pt-1">Pre-money</span>
                  <span className="text-right tabular-nums font-bold text-amber-800 dark:text-amber-300 border-t border-amber-200 dark:border-amber-700 pt-1">{bdt(preMoneyValuation)}</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">New investment amount</label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="e.g. 200000"
                    value={newInvestmentAmt}
                    onChange={(e) => setNewInvestmentAmt(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                {newInvNum > 0 && (
                  <div className="rounded-md bg-amber-100 dark:bg-amber-900/30 px-2.5 py-2 flex items-center justify-between">
                    <span className="text-xs text-amber-800 dark:text-amber-300">Suggested share %</span>
                    <span className="text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300">
                      {suggestedPct.toFixed(1)}%
                    </span>
                  </div>
                )}
                {!cattleValuation.hasMarketPrice && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠ No market price set — cattle valued at cost basis. Set market price for accurate valuation.
                  </p>
                )}
              </div>

              <FormField label={`${t.partners.name} *`} id="pname">
                <Input id="pname" name="name" required />
              </FormField>

              <FormField label={t.partners.partner_type}>
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
                      {partnerTypeField === "capital" && t.partners.capital_partner}
                      {partnerTypeField === "labor" && t.partners.labor_partner}
                      {partnerTypeField === "hybrid" && t.partners.hybrid_partner}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capital">{t.partners.capital_partner}</SelectItem>
                    <SelectItem value="labor">{t.partners.labor_partner}</SelectItem>
                    <SelectItem value="hybrid">{t.partners.hybrid_partner}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {partnerTypeField !== "labor" && (
                <FormField label={t.partners.initial_investment} id="pinv">
                  <Input id="pinv" name="investment_amount" type="number" min="0" step="100" defaultValue="0" />
                </FormField>
              )}

              {partnerTypeField !== "capital" && (
                <>
                  <FormField label={t.partners.labor_value_monthly} id="plabor">
                    <Input id="plabor" name="labor_value_monthly" type="number" min="0" step="500" defaultValue="0" />
                  </FormField>
                  <FormField label="Cliff Period (months)" id="pcliff">
                    <Input id="pcliff" name="cliff_months" type="number" min="0" step="1" defaultValue="0" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Months before labor units start vesting (0 = immediate)
                    </p>
                  </FormField>
                </>
              )}

              {/* Share mode toggle */}
              <FormField label="Share Mode">
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
              </FormField>

              {shareModeField === "manual" && (
                <FormField label={t.partners.profit_share_pct} id="pshare">
                  <div className="flex items-center gap-2">
                    <Input
                      id="pshare"
                      name="profit_share_pct"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      defaultValue={suggestedPct > 0 ? suggestedPct.toFixed(1) : "0"}
                      key={suggestedPct.toFixed(1)}
                    />
                    {suggestedPct > 0 && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        ← suggested
                      </span>
                    )}
                  </div>
                </FormField>
              )}
              
              {partnerTypeField !== "labor" && (
                <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-card">
                  <div className="space-y-0.5">
                    <Label htmlFor="add-bears-loss" className="text-base">Bears Capital Loss</Label>
                    <p className="text-xs text-muted-foreground">Does this partner take a share of business losses?</p>
                  </div>
                  <input
                    type="checkbox"
                    id="add-bears-loss"
                    name="bears_loss"
                    value="true"
                    checked={bearsLossField}
                    onChange={(e) => setBearsLossField(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
              )}

              <FormField label={t.partners.joined_at} id="pjoined">
                <Input id="pjoined" name="joined_at" type="date" max={today} defaultValue={today} />
              </FormField>

              <FormField label={t.partners.notes} id="pnotes">
                <Textarea id="pnotes" name="notes" rows={2} maxLength={500} />
              </FormField>

              {addState?.error && <p className="text-sm text-destructive">{addState.error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  {t.partners.cancel}
                </Button>
                <Button type="submit" disabled={addPending}>
                  {addPending ? t.partners.saving : t.partners.save}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Transaction */}
        {partners.length > 0 && (
          <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
              <Banknote className="h-4 w-4" />
              {t.partners.add_transaction}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.partners.new_transaction}</DialogTitle>
              </DialogHeader>
              <form
                action={(fd) => {
                  fd.set("partner_id", selectedPartnerId);
                  fd.set("type", txnType);
                  txnAction(fd);
                }}
                className="space-y-4"
              >
                <FormField label={`${t.partners.partner_select} *`}>
                  <Select
                    value={selectedPartnerId === "" ? null : selectedPartnerId}
                    onValueChange={(v) => setSelectedPartnerId(v ?? "")}
                    required
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {selectedPartnerId
                          ? partners.find((p) => p.id === selectedPartnerId)?.name
                          : <span className="text-muted-foreground">{t.partners.choose_partner}</span>}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label={t.partners.transaction_type}>
                  <Select value={txnType} onValueChange={(v) => setTxnType(v as "investment" | "withdrawal")}>
                    <SelectTrigger>
                      <span className="truncate">{txnType ? TXN_LABEL(t)[txnType] : ""}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investment">{TXN_LABEL(t).investment}</SelectItem>
                      <SelectItem value="withdrawal">{TXN_LABEL(t).withdrawal}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label={`${t.partners.amount} *`} id="tamount">
                  <Input id="tamount" name="amount" type="number" min="1" step="any" required />
                </FormField>

                <FormField label={t.partners.date} id="tdate">
                  <Input id="tdate" name="recorded_at" type="date" max={today} defaultValue={today} />
                </FormField>

                <FormField label={t.partners.notes} id="tnotes">
                  <Input id="tnotes" name="notes" placeholder={t.partners.optional_notes} />
                </FormField>

                {txnState?.error && <p className="text-sm text-destructive">{txnState.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setTxnOpen(false)}>
                    {t.partners.cancel}
                  </Button>
                  <Button type="submit" disabled={txnPending}>
                    {txnPending ? t.partners.saving : t.partners.save}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ── Declare Distribution modal ───────────────────────────────── */}
      {distOpen && (
        <DeclareDistributionModal
          partnerAccounts={accounts}
          netPL={netPL}
          today={today}
          t={t}
          onClose={() => setDistOpen(false)}
        />
      )}

      {/* ── Equity Distribution (Cap Table) ─────────────────────────── */}
      {partners.length >= 2 && (
        <div className="rounded-xl bg-card border border-border shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Equity Distribution</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capital accounts &amp; profit share allocation
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Business Value</p>
              <p className="text-sm font-bold tabular-nums">
                {totalBusinessValue >= 0 ? "" : "−"}৳
                {Math.round(Math.abs(totalBusinessValue)).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <PartnerEquityChart
            entries={accounts.map(({ partner: p, sharePct, acc }) => ({
              id: p.id,
              name: p.name,
              equity: acc.equity,
              sharePct,
              investedNet: acc.totalInvested - acc.withdrawn,
            } as EquityEntry))}
            totalBusinessValue={totalBusinessValue}
          />
        </div>
      )}

      {/* ── Partner cards ────────────────────────────────────────────── */}
      {partners.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map(({ partner: p, sharePct, acc }) => {
            const txns = txnsByPartner[p.id] ?? [];
            const netInv = computeNetInvestment(p, txns);
            return (
              <PartnerCard
                key={p.id}
                partner={p}
                transactions={txns}
                acc={acc}
                netInvestment={netInv}
                totalInvested={totalInvested}
                totalBusinessValue={totalBusinessValue}
                sharePct={sharePct}
                cattleValuation={cattleValuation}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* ── Recent Activity ──────────────────────────────────────────── */}
      {allRecentTxns.length > 0 && (
        <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest transactions across all partners
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {allRecentTxns.map((txn) => {
              const meta = TXN_SIGN[txn.type];
              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                    {TXN_ICON[txn.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {txn.partnerName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TXN_LABEL(t)[txn.type]}
                      {txn.notes && (
                        <span className="ml-1 opacity-70">· {txn.notes}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        TXN_TEXT[txn.type]
                      )}
                    >
                      {meta}{bdt(txn.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(
                        txn.recorded_at + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DeclareDistributionModal ──────────────────────────────────────────────────

interface AccountEntry {
  partner: Partner;
  sharePct: number;
  acc: ReturnType<typeof computeAccount>;
}

function DeclareDistributionModal({
  partnerAccounts,
  netPL,
  today,
  t,
  onClose,
}: {
  partnerAccounts: AccountEntry[];
  netPL: number;
  today: string;
  t: Dictionary;
  onClose: () => void;
}) {
  const isLoss = netPL < 0;

  const pendingEntries = partnerAccounts
    .map(({ partner: p, acc }) => ({
      partner: p,
      pending: isLoss ? acc.pendingLoss : acc.pendingProfit,
    }))
    .filter((e) => e.pending > 0);

  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(pendingEntries.map((e) => [e.partner.id, e.pending.toFixed(0)]))
  );
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalAmount = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  function handleConfirm() {
    if (!date) { setError("তারিখ দিন"); return; }
    const entries = pendingEntries
      .map((e) => ({
        partnerId: e.partner.id,
        amount: parseFloat(amounts[e.partner.id] ?? "0") || 0,
        maxAmount: e.pending,
      }))
      .filter((e) => e.amount > 0);
    if (!entries.length) { setError("কোনো পরিমাণ নেই"); return; }

    startTransition(async () => {
      const result = await declareDistribution({ totalAmount, date, isLoss, entries });
      if (result.error) { setError(result.error); return; }
      onClose();
    });
  }

  if (pendingEntries.length === 0) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t.partners.declare_distribution_title}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">{t.partners.all_distributed}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>{t.partners.cancel}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoss
              ? <TrendingDown className="h-4 w-4 text-orange-500" />
              : <TrendingUp className="h-4 w-4 text-emerald-500" />}
            {t.partners.declare_distribution_title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.partners.date}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>

          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
              {t.partners.distribution_preview}
            </div>
            <div className="divide-y">
              {pendingEntries.map(({ partner: p, pending }) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className={isLoss ? "text-orange-600" : "text-emerald-600"}>
                        Pending {bdt(pending)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">৳</span>
                    <Input
                      type="number" min="0" step="100"
                      value={amounts[p.id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-28 h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={cn("flex justify-between items-center px-3 py-2.5 border-t text-sm font-semibold", isLoss ? "text-orange-600" : "text-emerald-600")}>
              <span>Total</span>
              <span>{bdt(totalAmount)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>{t.partners.cancel}</Button>
            <Button onClick={handleConfirm} disabled={isPending || totalAmount <= 0}>
              {isPending ? t.partners.distributing : t.partners.confirm_distribute}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PartnerCard ───────────────────────────────────────────────────────────────

function PartnerCard({
  partner: p,
  transactions,
  acc,
  netInvestment,
  totalInvested,
  totalBusinessValue,
  sharePct,
  cattleValuation,
  t,
}: {
  partner: Partner;
  transactions: PartnerTransaction[];
  acc: ReturnType<typeof computeAccount>;
  netInvestment: number;
  totalInvested: number;
  totalBusinessValue: number;
  sharePct: number;
  cattleValuation: CattleValuation;
  t: Dictionary;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePartner(p.id);
      if (result?.error) toast.error(result.error);
      else toast.success(`${p.name} removed`);
    });
  }

  const type = (p.partner_type ?? "capital") as PartnerType;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.capital;
  const isLoss = acc.pendingLoss > 0;
  const hasPending = acc.pendingProfit + acc.pendingLoss > 0;
  const pendingAmt = isLoss ? acc.pendingLoss : acc.pendingProfit;
  const months = acc.months;
  const cliff = p.cliff_months ?? 0;
  const cliffPassed = months >= cliff;
  const vestedMonths = cliffPassed ? months : 0;

  const avColor = avatarColor(p.name);
  const initStr = initials(p.name);
  const roi =
    acc.totalInvested > 0
      ? ((acc.equity - acc.totalInvested) / acc.totalInvested) * 100
      : null;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden shadow-card card-interactive flex flex-col">
      {/* Colored top accent */}
      <div className={cn("h-1.5 w-full flex-shrink-0", avColor)} />

      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        {/* ── Header: avatar + name + actions ─────────────────────── */}
        <div className="flex items-start gap-3">
          <Link href={`/dashboard/partners/${p.id}`} className="flex-shrink-0 mt-0.5">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm select-none",
              avColor
            )}>
              {initStr}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <Link
              href={`/dashboard/partners/${p.id}`}
              className="text-[15px] font-bold text-foreground hover:text-primary transition-colors leading-snug"
            >
              {p.name}
            </Link>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge className={cfg.cls}>{cfg.icon}{cfg.label(t)}</Badge>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Layers className="h-3 w-3" />{sharePct.toFixed(1)}%
              </Badge>
              {hasPending && (
                <Badge className={isLoss
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                }>
                  <Clock className="h-3 w-3" />
                  {isLoss ? "Loss due" : "Profit due"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Joined{" "}
              {new Date(p.joined_at + "T00:00:00").toLocaleDateString("en-US", {
                month: "short", year: "numeric",
              })}
              {" · "}{months}mo active
            </p>
          </div>

          <div className="shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 text-xs border border-destructive/30 rounded-lg px-2 py-1 bg-destructive/5">
                <span className="text-destructive font-medium">{t.partners.delete_confirm}</span>
                <button onClick={handleDelete} disabled={isDeleting} className="text-destructive font-bold hover:underline">
                  {t.partners.confirm_yes}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-foreground hover:underline">
                  {t.partners.confirm_no}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <EditPartnerDialog partner={p} transactions={transactions} t={t} />
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Key metrics row ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {type !== "labor" ? (
            <QuickStat label="Invested" value={bdt(acc.totalInvested)} />
          ) : (
            <QuickStat label="Labor Value" value={bdt(acc.laborValue)} />
          )}
          <QuickStat
            label="Equity"
            value={(acc.equity >= 0 ? "" : "−") + bdt(acc.equity)}
            color={acc.equity >= 0 ? "green" : "red"}
          />
          {roi !== null ? (
            <QuickStat
              label="ROI"
              value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
              color={roi >= 0 ? "green" : "red"}
            />
          ) : (
            <QuickStat label="Share" value={`${sharePct.toFixed(1)}%`} />
          )}
        </div>

        {/* ── Status row (pending + vesting inline) ────────────────── */}
        {(hasPending || (type !== "capital" && p.labor_value_monthly && p.labor_value_monthly > 0)) && (
          <div className="flex flex-wrap gap-2">
            {hasPending && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                isLoss
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              )}>
                <Clock className="h-3 w-3" />
                {isLoss ? "Loss due" : "Profit due"}: {bdt(pendingAmt)}
              </span>
            )}
            {type !== "capital" && p.labor_value_monthly && p.labor_value_monthly > 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full",
                cliffPassed
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              )}>
                <Wrench className="h-3 w-3" />
                {cliffPassed ? `${vestedMonths}mo vested` : `Cliff: ${months}/${cliff}mo`}
              </span>
            )}
          </div>
        )}

        {/* ── Recent transactions ───────────────────────────────────── */}
        {transactions.length > 0 ? (
          <div className="rounded-xl bg-muted/30 border border-border/40 overflow-hidden">
            {transactions.slice(0, 3).map((txn, i) => (
              <div key={txn.id} className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs",
                i > 0 && "border-t border-border/30"
              )}>
                <span className="flex-shrink-0">{TXN_ICON[txn.type]}</span>
                <span className="flex-1 text-muted-foreground truncate">{TXN_LABEL(t)[txn.type]}</span>
                <span className={cn("font-bold tabular-nums", TXN_TEXT[txn.type])}>
                  {TXN_SIGN[txn.type]}{bdt(txn.amount)}
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                  {new Date(txn.recorded_at + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short", day: "numeric",
                  })}
                </span>
              </div>
            ))}
            {transactions.length > 3 && (
              <div className="px-3 py-1.5 border-t border-border/30 bg-muted/20">
                <Link href={`/dashboard/partners/${p.id}`} className="text-[11px] text-primary hover:underline font-medium">
                  +{transactions.length - 3} more →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/20 border border-dashed border-border/50 px-3 py-3 text-center">
            <p className="text-xs text-muted-foreground">No transactions yet</p>
          </div>
        )}

        {p.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-border/50 pl-2">{p.notes}</p>
        )}

        {/* ── View profile CTA ─────────────────────────────────────── */}
        <Link
          href={`/dashboard/partners/${p.id}`}
          className="mt-auto flex items-center justify-between w-full rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-all group"
        >
          <span>Full Profile &amp; Transactions</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ── EditPartnerDialog ─────────────────────────────────────────────────────────

function EditPartnerDialog({ partner: p, transactions, t }: { partner: Partner; transactions: PartnerTransaction[]; t: Dictionary }) {
  const actualCapital = totalCapitalOf(transactions);
  const [open, setOpen] = useState(false);
  const [partnerTypeField, setPartnerTypeField] = useState<PartnerType>(p.partner_type ?? "capital");
  const [shareModeField, setShareModeField] = useState<"auto" | "manual">(p.share_mode ?? "auto");
  const [bearsLossField, setBearsLossField] = useState(p.bears_loss ?? true);
  const [state, action, pending] = useActionState(updatePartner, undefined);

  useEffect(() => {
    if (state?.success) {
      setTimeout(() => {
        toast.success("Partner updated");
        setOpen(false);
      }, 0);
    }
  }, [state]);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setPartnerTypeField(p.partner_type ?? "capital");
        setShareModeField(p.share_mode ?? "auto");
        setBearsLossField(p.bears_loss ?? true);
      }, 0);
    }
  }, [open, p.partner_type, p.share_mode, p.bears_loss]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Edit partner"
      >
        <Pencil className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Partner</DialogTitle>
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
          <FormField label={`${t.partners.name} *`} id="ename">
            <Input id="ename" name="name" required defaultValue={p.name} />
          </FormField>

          <FormField label={t.partners.partner_type}>
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
                  {partnerTypeField === "capital" && t.partners.capital_partner}
                  {partnerTypeField === "labor" && t.partners.labor_partner}
                  {partnerTypeField === "hybrid" && t.partners.hybrid_partner}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="capital">{t.partners.capital_partner}</SelectItem>
                <SelectItem value="labor">{t.partners.labor_partner}</SelectItem>
                <SelectItem value="hybrid">{t.partners.hybrid_partner}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {partnerTypeField !== "labor" && (
            <FormField label={t.partners.initial_investment} id="einv">
              <Input id="einv" name="investment_amount" type="number" min="0" step="100" defaultValue={actualCapital} />
              <p className="text-xs text-muted-foreground mt-1">
                Capital is tracked via the Capital Ledger — use it to add or edit investments.
              </p>
            </FormField>
          )}

          {partnerTypeField !== "capital" && (
            <>
              <FormField label={t.partners.labor_value_monthly} id="elabor">
                <Input id="elabor" name="labor_value_monthly" type="number" min="0" step="500" defaultValue={p.labor_value_monthly ?? 0} />
              </FormField>
              <FormField label="Cliff Period (months)" id="ecliff">
                <Input id="ecliff" name="cliff_months" type="number" min="0" step="1" defaultValue={p.cliff_months ?? 0} />
                <p className="text-xs text-muted-foreground mt-1">
                  Months before labor units start vesting (0 = immediate)
                </p>
              </FormField>
            </>
          )}

          {/* Share mode toggle */}
          <FormField label="Share Mode">
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
          </FormField>

          {shareModeField === "manual" && (
            <FormField label={t.partners.profit_share_pct} id="eshare">
              <Input id="eshare" name="profit_share_pct" type="number" min="0" max="100" step="0.5" defaultValue={p.profit_share_pct} />
            </FormField>
          )}

          {partnerTypeField !== "labor" && (
            <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-card">
              <div className="space-y-0.5">
                <Label htmlFor={`edit-bears-loss-${p.id}`} className="text-base">Bears Capital Loss</Label>
                <p className="text-xs text-muted-foreground">Does this partner take a share of business losses?</p>
              </div>
              <input
                type="checkbox"
                id={`edit-bears-loss-${p.id}`}
                name="bears_loss"
                value="true"
                checked={bearsLossField}
                onChange={(e) => setBearsLossField(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          )}

          <FormField label={t.partners.joined_at} id="ejoined">
            <Input id="ejoined" name="joined_at" type="date" defaultValue={p.joined_at} />
          </FormField>

          <FormField label={t.partners.notes} id="enotes">
            <Textarea id="enotes" name="notes" rows={2} maxLength={500} defaultValue={p.notes ?? ""} />
          </FormField>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t.partners.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending ? t.partners.saving : t.partners.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  iconCls,
  valueColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconCls: string;
  valueColor?: "green" | "red";
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
    </div>
  );
}

function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  return (
    <div className="rounded-xl bg-muted/40 dark:bg-muted/20 px-2.5 py-2.5 border border-border/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          color === "green"
            ? "text-emerald-600 dark:text-emerald-400"
            : color === "red"
            ? "text-destructive"
            : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full", className)}>
      {children}
    </span>
  );
}

function FormField({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ t }: { t: Dictionary }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center">
      <Users className="mb-3 h-12 w-12 text-muted-foreground/30" />
      <h3 className="text-base font-semibold">{t.partners.no_partners}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.partners.no_partners_desc}</p>
    </div>
  );
}
