import type { Partner, PartnerTransaction } from "@/types/database";
import type {
  PartnerEquityBreakdown,
  FarmEquitySummary,
  PartnerLedgerEntry,
  PartnerSettlementSchedule,
  PartnerValidationResult,
} from "./types";
import {
  monthsActive,
  totalCapitalOf,
  computeNetInvestment,
  effectiveShare,
  computeAccount,
  type PartnerAccountSummary,
} from "./calculations";

export class PartnerEngine {
  public static calculateMonthsActive(joinedAt: string): number {
    return monthsActive(joinedAt);
  }

  public static computeTotalCapital(txns: PartnerTransaction[]): number {
    return totalCapitalOf(txns);
  }

  public static computeNetInvestment(partner: Partner, txns: PartnerTransaction[]): number {
    return computeNetInvestment(partner, txns);
  }

  public static calculateEffectiveShare(
    partner: Partner,
    allPartners: Partner[],
    txnsByPartner: Record<string, PartnerTransaction[]>
  ): number {
    return effectiveShare(partner, allPartners, txnsByPartner);
  }

  public static calculateAccountSummary(
    partner: Partner,
    txns: PartnerTransaction[],
    netPLForPartner: number,
    sharePct: number
  ): PartnerAccountSummary {
    return computeAccount(partner, txns, netPLForPartner, sharePct);
  }

  public static calculatePartnerEquity(params: {
    partner: Partner;
    allPartners: Partner[];
    txnsByPartner: Record<string, PartnerTransaction[]>;
    netPLAfterFee: number;
    totalUnrealizedValuationGain?: number;
  }): PartnerEquityBreakdown {
    const { partner, allPartners, txnsByPartner, netPLAfterFee, totalUnrealizedValuationGain = 0 } = params;
    const txns = txnsByPartner[partner.id] ?? [];
    const sharePct = this.calculateEffectiveShare(partner, allPartners, txnsByPartner);
    const netPLForPartner = netPLAfterFee - (partner.entry_netpl ?? 0);
    const acc = this.calculateAccountSummary(partner, txns, netPLForPartner, sharePct);

    const mActive = monthsActive(partner.joined_at);
    const cliff = partner.cliff_months ?? 0;
    const vestedMonths = mActive >= cliff ? mActive : 0;

    const unrealizedValuationShare =
      totalUnrealizedValuationGain > 0 && sharePct > 0
        ? Math.round(((totalUnrealizedValuationGain * sharePct) / 100) * 100) / 100
        : 0;

    const currentBookEquity = acc.equity;
    const currentMarketEquity = currentBookEquity + unrealizedValuationShare;

    const roiPct =
      acc.totalInvested > 0
        ? Math.round(((currentBookEquity - acc.totalInvested) / acc.totalInvested) * 10000) / 100
        : null;

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      partnerType: partner.partner_type,
      shareMode: partner.share_mode ?? "auto",
      effectiveSharePct: Math.round(sharePct * 100) / 100,
      initialInvestment: partner.investment_amount ?? 0,
      totalContributedCapital: acc.totalInvested,
      totalWithdrawnCapital: acc.withdrawn,
      netContributedCapital: acc.totalInvested - acc.withdrawn,
      vestedLaborMonths: vestedMonths,
      vestedLaborValue: acc.laborValue,
      totalRealizedProfit: acc.profitReceived,
      totalRealizedLoss: acc.lossBorne,
      pendingProfit: acc.pendingProfit,
      pendingLoss: acc.pendingLoss,
      currentBookEquity,
      unrealizedValuationShare,
      currentMarketEquity,
      roiPct,
      monthsActive: mActive,
    };
  }


  public static calculateFarmEquitySummary(params: {
    partners: Partner[];
    txnsByPartner: Record<string, PartnerTransaction[]>;
    netPL: number;
    mgmtFeeRate?: number;
    totalUnrealizedValuationGain?: number;
  }): FarmEquitySummary {
    const { partners, txnsByPartner, netPL, mgmtFeeRate = 0, totalUnrealizedValuationGain = 0 } = params;

    const mgmtFeeAmount = netPL > 0 ? (netPL * mgmtFeeRate) / 100 : 0;
    const netPLAfterFee = netPL - mgmtFeeAmount;

    const breakdowns = partners.map((p) =>
      this.calculatePartnerEquity({
        partner: p,
        allPartners: partners,
        txnsByPartner,
        netPLAfterFee,
        totalUnrealizedValuationGain,
      })
    );

    const totalContributedCapital = breakdowns.reduce((s, b) => s + b.totalContributedCapital, 0);
    const totalWithdrawnCapital = breakdowns.reduce((s, b) => s + b.totalWithdrawnCapital, 0);
    const netContributedCapital = totalContributedCapital - totalWithdrawnCapital;
    const totalVestedLaborValue = breakdowns.reduce((s, b) => s + b.vestedLaborValue, 0);
    const totalDistributedProfit = breakdowns.reduce((s, b) => s + b.totalRealizedProfit, 0);
    const totalAllocatedLoss = breakdowns.reduce((s, b) => s + b.totalRealizedLoss, 0);
    const totalPendingDistribution = breakdowns.reduce((s, b) => s + b.pendingProfit + b.pendingLoss, 0);
    const totalBookEquity = breakdowns.reduce((s, b) => s + b.currentBookEquity, 0);
    const totalMarketEquity = totalBookEquity + totalUnrealizedValuationGain;

    const manualOwnershipAllocated = breakdowns
      .filter((b) => b.shareMode === "manual")
      .reduce((s, b) => s + b.effectiveSharePct, 0);

    const autoOwnershipAllocated = breakdowns
      .filter((b) => b.shareMode !== "manual")
      .reduce((s, b) => s + b.effectiveSharePct, 0);

    const totalOwnership = manualOwnershipAllocated + autoOwnershipAllocated;
    const ownershipBalanced =
      partners.length === 0 ||
      Math.abs(totalOwnership - 100) < 0.1 ||
      (manualOwnershipAllocated <= 100 && partners.some((p) => p.share_mode !== "manual"));

    return {
      totalPartners: partners.length,
      totalContributedCapital: Math.round(totalContributedCapital * 100) / 100,
      totalWithdrawnCapital: Math.round(totalWithdrawnCapital * 100) / 100,
      netContributedCapital: Math.round(netContributedCapital * 100) / 100,
      totalVestedLaborValue: Math.round(totalVestedLaborValue * 100) / 100,
      totalDistributedProfit: Math.round(totalDistributedProfit * 100) / 100,
      totalAllocatedLoss: Math.round(totalAllocatedLoss * 100) / 100,
      totalPendingDistribution: Math.round(totalPendingDistribution * 100) / 100,
      totalBookEquity: Math.round(totalBookEquity * 100) / 100,
      totalUnrealizedValuationGain: Math.round(totalUnrealizedValuationGain * 100) / 100,
      totalMarketEquity: Math.round(totalMarketEquity * 100) / 100,
      manualOwnershipAllocated: Math.round(manualOwnershipAllocated * 100) / 100,
      autoOwnershipAllocated: Math.round(autoOwnershipAllocated * 100) / 100,
      ownershipBalanced,
      partners: breakdowns,
    };
  }

  public static buildCapitalLedger(params: {
    transactions: PartnerTransaction[];
    partnersById: Record<string, Partner>;
    businessId: string;
  }): PartnerLedgerEntry[] {
    const { transactions, partnersById, businessId } = params;

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );

    let runningCapital = 0;

    return sorted
      .map((t) => {
        const p = partnersById[t.partner_id];
        const pName = p?.name ?? "Unknown Partner";
        const amount = Number(t.amount) || 0;

        let debitAccount = "1010";
        let creditAccount = "3010";

        if (t.type === "investment") {
          debitAccount = "1010";
          creditAccount = "3010";
          runningCapital += amount;
        } else if (t.type === "withdrawal") {
          debitAccount = "3020";
          creditAccount = "1010";
          runningCapital -= amount;
        } else if (t.type === "profit") {
          debitAccount = "3020";
          creditAccount = "1010";
        } else if (t.type === "loss_allocation") {
          debitAccount = "3010";
          creditAccount = "3200";
        }

        return {
          id: `ledger-${t.id}`,
          transactionId: t.id,
          partnerId: t.partner_id,
          partnerName: pName,
          businessId,
          type: t.type,
          amount,
          recordedAt: t.recorded_at,
          notes: t.notes ?? null,
          debitAccount,
          creditAccount,
          referenceNumber: `PL-${t.id.slice(0, 8).toUpperCase()}`,
          runningBalance: Math.round(runningCapital * 100) / 100,
        };
      })
      .reverse();
  }


  public static evaluateSettlement(params: {
    equity: PartnerEquityBreakdown;
    settlementType: "profit_payout" | "capital_return" | "equity_buyout" | "loss_reimbursement";
    requestedAmount?: number;
    availableCash: number;
  }): PartnerSettlementSchedule {
    const { equity, settlementType, requestedAmount, availableCash } = params;

    let amountDue = 0;
    let canExecute = true;
    let blockReason: string | null = null;

    if (settlementType === "profit_payout") {
      amountDue = requestedAmount ?? equity.pendingProfit;
      if (amountDue <= 0) {
        canExecute = false;
        blockReason = "No pending profit available for distribution";
      } else if (amountDue > equity.pendingProfit) {
        canExecute = false;
        blockReason = `Requested payout (৳${amountDue}) exceeds pending profit (৳${equity.pendingProfit})`;
      }
    } else if (settlementType === "capital_return" || settlementType === "equity_buyout") {
      amountDue = requestedAmount ?? equity.currentBookEquity;
      if (amountDue <= 0) {
        canExecute = false;
        blockReason = "Partner has zero or negative equity";
      } else if (amountDue > equity.currentBookEquity) {
        canExecute = false;
        blockReason = `Requested capital return (৳${amountDue}) exceeds current equity (৳${equity.currentBookEquity})`;
      }
    } else if (settlementType === "loss_reimbursement") {
      amountDue = requestedAmount ?? equity.pendingLoss;
      if (amountDue <= 0) {
        canExecute = false;
        blockReason = "No allocated loss to settle";
      }
    }

    if (canExecute && settlementType !== "loss_reimbursement" && amountDue > availableCash) {
      canExecute = false;
      blockReason = `Insufficient farm cash (৳${availableCash}) to execute settlement (৳${amountDue})`;
    }

    return {
      partnerId: equity.partnerId,
      partnerName: equity.partnerName,
      settlementType,
      amountDue: Math.round(amountDue * 100) / 100,
      pendingProfit: equity.pendingProfit,
      pendingLoss: equity.pendingLoss,

      currentEquity: equity.currentBookEquity,
      availableCash,
      canExecute,
      blockReason,
    };
  }

  public static validatePartner(params: {
    name: string;
    partnerType: string;
    shareMode: string;
    profitSharePct: number;
    existingPartners: Partner[];
    editingPartnerId?: string;
  }): PartnerValidationResult {
    const errors: string[] = [];
    const name = params.name.trim();

    if (!name) {
      errors.push("Partner name is required");
    }

    if (!["capital", "labor", "hybrid"].includes(params.partnerType)) {
      errors.push("Invalid partner type. Must be capital, labor, or hybrid");
    }

    if (params.shareMode === "manual") {
      if (isNaN(params.profitSharePct) || params.profitSharePct < 0 || params.profitSharePct > 100) {
        errors.push("Profit share percentage must be between 0% and 100%");
      }

      const manualPartners = params.existingPartners.filter(
        (p) => p.share_mode === "manual" && p.id !== params.editingPartnerId
      );
      const currentManualSum = manualPartners.reduce((s, p) => s + (p.profit_share_pct || 0), 0);

      if (currentManualSum + params.profitSharePct > 100) {
        errors.push(
          `Total manual profit share exceeds 100% (currently ${currentManualSum.toFixed(1)}% allocated)`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  public static validateTransaction(params: {
    partnerId: string;
    type: string;
    amount: number;
    recordedAt: string;
    partnerEquity?: PartnerEquityBreakdown;
    availableCash?: number;
  }): PartnerValidationResult {
    const errors: string[] = [];

    if (!params.partnerId) {
      errors.push("Partner is required");
    }

    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      errors.push("Amount must be a positive number greater than 0");
    }

    if (!["investment", "withdrawal", "profit", "loss_allocation"].includes(params.type)) {
      errors.push("Invalid transaction type");
    }

    if (!params.recordedAt || isNaN(Date.parse(params.recordedAt))) {
      errors.push("Valid transaction date is required");
    }

    if (params.type === "withdrawal" && params.partnerEquity) {
      if (params.amount > params.partnerEquity.currentBookEquity) {
        errors.push(
          `Withdrawal amount (৳${params.amount}) exceeds partner current equity (৳${params.partnerEquity.currentBookEquity})`
        );
      }
      if (params.availableCash !== undefined && params.amount > params.availableCash) {
        errors.push(
          `Withdrawal amount (৳${params.amount}) exceeds farm available cash (৳${params.availableCash})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
