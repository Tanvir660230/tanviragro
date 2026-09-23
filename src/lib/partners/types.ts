/**
 * Partner Capital Ledger & Equity Engine Types (Phase 6 Architecture)
 */

import type { Partner, PartnerTransaction, PartnerTransactionType, PartnerType } from "@/types/database";

export interface PartnerLedgerEntry {
  id: string;
  transactionId: string;
  partnerId: string;
  partnerName: string;
  businessId: string;
  type: PartnerTransactionType;
  amount: number;
  recordedAt: string;
  notes: string | null;
  debitAccount?: string;
  creditAccount?: string;
  referenceNumber: string;
  runningBalance?: number;
}

export interface PartnerEquityBreakdown {
  partnerId: string;
  partnerName: string;
  partnerType: PartnerType;
  shareMode: "auto" | "manual";
  effectiveSharePct: number;
  initialInvestment: number;
  totalContributedCapital: number;
  totalWithdrawnCapital: number;
  netContributedCapital: number;
  vestedLaborMonths: number;
  vestedLaborValue: number;
  totalRealizedProfit: number;
  totalRealizedLoss: number;
  pendingProfit: number;
  pendingLoss: number;
  currentBookEquity: number;
  unrealizedValuationShare: number;
  currentMarketEquity: number;
  roiPct: number | null;
  monthsActive: number;
}

export interface FarmEquitySummary {
  totalPartners: number;
  totalContributedCapital: number;
  totalWithdrawnCapital: number;
  netContributedCapital: number;
  totalVestedLaborValue: number;
  totalDistributedProfit: number;
  totalAllocatedLoss: number;
  totalPendingDistribution: number;
  totalBookEquity: number;
  totalUnrealizedValuationGain: number;
  totalMarketEquity: number;
  manualOwnershipAllocated: number;
  autoOwnershipAllocated: number;
  ownershipBalanced: boolean;
  partners: PartnerEquityBreakdown[];
}

export interface PartnerSettlementSchedule {
  partnerId: string;
  partnerName: string;
  settlementType: "profit_payout" | "capital_return" | "equity_buyout" | "loss_reimbursement";
  amountDue: number;
  pendingProfit: number;
  pendingLoss: number;
  currentEquity: number;
  availableCash: number;
  canExecute: boolean;
  blockReason?: string | null;
}

export interface PartnerValidationResult {
  isValid: boolean;
  errors: string[];
}
