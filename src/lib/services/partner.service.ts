import {
  effectiveShare,
  computeAccount,
  computeNetInvestment,
  totalCapitalOf,
  monthsActive,
  type PartnerAccountSummary,
} from "@/lib/partners/calculations";
import { PartnerEngine } from "@/lib/partners/partner-engine";
import type { Partner, PartnerTransaction } from "@/types/database";
import type {
  PartnerEquityBreakdown,
  FarmEquitySummary,
  PartnerLedgerEntry,
  PartnerSettlementSchedule,
  PartnerValidationResult,
} from "@/lib/partners/types";

export class PartnerDomainService {
  /**
   * Calculates dynamic profit/loss share percentage for a partner
   */
  public static calculateShare(
    partner: Partner,
    allPartners: Partner[],
    transactionsByPartner: Record<string, PartnerTransaction[]>
  ): number {
    return PartnerEngine.calculateEffectiveShare(partner, allPartners, transactionsByPartner);
  }

  /**
   * Computes complete account ledger summary for a partner
   */
  public static calculatePartnerAccount(
    partner: Partner,
    transactions: PartnerTransaction[],
    netPL: number,
    sharePct: number
  ): PartnerAccountSummary {
    return PartnerEngine.calculateAccountSummary(partner, transactions, netPL, sharePct);
  }

  /**
   * Computes single partner equity and financial state
   */
  public static calculatePartnerEquity(params: {
    partner: Partner;
    allPartners: Partner[];
    txnsByPartner: Record<string, PartnerTransaction[]>;
    netPLAfterFee: number;
    totalUnrealizedValuationGain?: number;
  }): PartnerEquityBreakdown {
    return PartnerEngine.calculatePartnerEquity(params);
  }

  /**
   * Compiles farm-wide consolidated Equity and Partner Portfolio Summary
   */
  public static calculateFarmEquitySummary(params: {
    partners: Partner[];
    txnsByPartner: Record<string, PartnerTransaction[]>;
    netPL: number;
    mgmtFeeRate?: number;
    totalUnrealizedValuationGain?: number;
  }): FarmEquitySummary {
    return PartnerEngine.calculateFarmEquitySummary(params);
  }

  /**
   * Generates chronological, double-entry mapped Capital Ledger
   */
  public static buildCapitalLedger(params: {
    transactions: PartnerTransaction[];
    partnersById: Record<string, Partner>;
    businessId: string;
  }): PartnerLedgerEntry[] {
    return PartnerEngine.buildCapitalLedger(params);
  }

  /**
   * Evaluates settlement readiness and eligibility for partner payouts
   */
  public static evaluateSettlement(params: {
    equity: PartnerEquityBreakdown;
    settlementType: "profit_payout" | "capital_return" | "equity_buyout" | "loss_reimbursement";
    requestedAmount?: number;
    availableCash: number;
  }): PartnerSettlementSchedule {
    return PartnerEngine.evaluateSettlement(params);
  }

  /**
   * Validates partner profile creation/update
   */
  public static validatePartner(params: {
    name: string;
    partnerType: string;
    shareMode: string;
    profitSharePct: number;
    existingPartners: Partner[];
    editingPartnerId?: string;
  }): PartnerValidationResult {
    return PartnerEngine.validatePartner(params);
  }

  /**
   * Validates partner transaction entry
   */
  public static validateTransaction(params: {
    partnerId: string;
    type: string;
    amount: number;
    recordedAt: string;
    partnerEquity?: PartnerEquityBreakdown;
    availableCash?: number;
  }): PartnerValidationResult {
    return PartnerEngine.validateTransaction(params);
  }

  /**
   * Computes total net invested capital including vested labor
   */
  public static calculateNetInvestment(
    partner: Partner,
    transactions: PartnerTransaction[]
  ): number {
    return PartnerEngine.computeNetInvestment(partner, transactions);
  }

  /**
   * Computes total invested cash
   */
  public static calculateTotalCapital(transactions: PartnerTransaction[]): number {
    return PartnerEngine.computeTotalCapital(transactions);
  }

  /**
   * Months active in partnership
   */
  public static getMonthsActive(joinedAt: string): number {
    return PartnerEngine.calculateMonthsActive(joinedAt);
  }
}


