"use client";

import { useState } from "react";
import {
  Users,
  Banknote,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Partner, PartnerTransaction } from "@/types/database";
import { useTranslation } from "@/i18n/I18nProvider";
import {
  bdt,
  totalCapitalOf,
  computeNetInvestment,
  effectiveShare,
  computeAccount,
} from "@/lib/partners/calculations";
import { PartnerDomainService } from "@/lib/services/partner.service";

import {
  PartnerEquityChart,
  type EquityEntry,
} from "@/components/partners/PartnerEquityChart";
import {
  SummaryCard,
  EmptyState,
  TXN_ICON,
  TXN_LABEL,
  TXN_SIGN,
  TXN_TEXT,
} from "./partner-ui";
import { PartnerCard } from "./PartnerCard";
import { AddPartnerDialog } from "./modals/AddPartnerDialog";
import { AddTransactionDialog } from "./modals/AddTransactionDialog";
import { DeclareDistributionModal } from "./modals/DeclareDistributionModal";

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

  const [distOpen, setDistOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // Management fee
  const mgmtFeeAmount = netPL > 0 ? (netPL * mgmtFeeRate) / 100 : 0;
  const netPLAfterFee = netPL - mgmtFeeAmount;

  // Centralized Enterprise Equity & Partner Portfolio Engine
  const farmEquity = PartnerDomainService.calculateFarmEquitySummary({
    partners,
    txnsByPartner,
    netPL,
    mgmtFeeRate,
    totalUnrealizedValuationGain: cattleValuation.hasMarketPrice ? cattleValuation.totalUnrealizedGain : 0,
  });

  const totalCapital = farmEquity.totalContributedCapital;
  const totalEquity = farmEquity.totalBookEquity;
  const totalBusinessValue = farmEquity.totalMarketEquity;
  const totalPendingAmount = farmEquity.totalPendingDistribution;

  const accounts = farmEquity.partners.map((b) => ({
    partner: partners.find((p) => p.id === b.partnerId)!,
    sharePct: b.effectiveSharePct,
    acc: {
      totalInvested: b.totalContributedCapital,
      withdrawn: b.totalWithdrawnCapital,
      profitReceived: b.totalRealizedProfit,
      lossBorne: b.totalRealizedLoss,
      laborValue: b.vestedLaborValue,
      months: b.monthsActive,
      equity: b.currentBookEquity,
      pendingProfit: b.pendingProfit,
      pendingLoss: b.pendingLoss,
    },
  }));

  const pendingAccounts = accounts.filter(
    ({ acc }) => acc.pendingProfit + acc.pendingLoss > 0
  );

  const shareWarning = !farmEquity.ownershipBalanced;

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
          {farmEquity.manualOwnershipAllocated > 100
            ? t.partners.share_warning.replace("{{pct}}", farmEquity.manualOwnershipAllocated.toFixed(1))
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
        <AddPartnerDialog
          today={today}
          t={t}
          totalPartnerCapital={totalCapital}
          netPLAfterFee={netPLAfterFee}
          cattleValuation={cattleValuation}
          totalAssetValue={totalAssetValue}
        />

        {partners.length > 0 && (
          <AddTransactionDialog
            partners={partners}
            today={today}
            t={t}
          />
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
                totalInvested={totalCapital}
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


