import crypto from "crypto";
import type { Partner, PartnerTransaction } from "@/types/database";
import type { PartnerEquityBreakdown } from "./types";
import { PartnerEngine } from "./partner-engine";

export interface PartnerStatementPeriod {
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string;   // ISO string YYYY-MM-DD
}

export interface PartnerAccountStatement {
  statementId: string;
  businessId: string;
  partnerId: string;
  partnerName: string;
  partnerType: string;
  period: PartnerStatementPeriod;
  generatedAt: string;
  effectiveSharePct: number;
  openingBookEquity: number;
  capitalContributed: number;
  capitalWithdrawn: number;
  laborValueVested: number;
  profitAllocated: number;
  lossAllocated: number;
  closingBookEquity: number;
  unrealizedValuationShare: number;
  closingMarketEquity: number;
  annualizedRoiPct: number | null;
  transactionCount: number;
  auditHash: string;
}

export class PartnerStatementGenerator {
  /**
   * Generates a tamper-evident periodic investor capital statement.
   */
  public static generateStatement(params: {
    partner: Partner;
    allPartners: Partner[];
    txns: PartnerTransaction[];
    period: PartnerStatementPeriod;
    netPLAfterFeePeriod: number;
    totalUnrealizedValuationGain?: number;
    businessId: string;
  }): PartnerAccountStatement {
    const {
      partner,
      allPartners,
      txns,
      period,
      netPLAfterFeePeriod,
      totalUnrealizedValuationGain = 0,
      businessId,
    } = params;

    const priorTxns = txns.filter((t) => t.recorded_at < period.startDate);
    const periodTxns = txns.filter(
      (t) => t.recorded_at >= period.startDate && t.recorded_at <= period.endDate
    );

    const txnsByPartner: Record<string, PartnerTransaction[]> = { [partner.id]: txns };

    const currentEquity: PartnerEquityBreakdown = PartnerEngine.calculatePartnerEquity({
      partner,
      allPartners,
      txnsByPartner,
      netPLAfterFee: netPLAfterFeePeriod,
      totalUnrealizedValuationGain,
    });

    const capitalContributed = periodTxns
      .filter((t) => t.type === "investment")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const capitalWithdrawn = periodTxns
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const profitAllocated = periodTxns
      .filter((t) => t.type === "profit")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const lossAllocated = periodTxns
      .filter((t) => t.type === "loss_allocation")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const openingBookEquity = Math.max(
      0,
      currentEquity.currentBookEquity - capitalContributed + capitalWithdrawn - profitAllocated + lossAllocated
    );

    const closingBookEquity = currentEquity.currentBookEquity;
    const closingMarketEquity = currentEquity.currentMarketEquity;

    const startMs = new Date(period.startDate).getTime();
    const endMs = new Date(period.endDate).getTime();
    const daysInPeriod = Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24));
    const yearFraction = daysInPeriod / 365;

    let annualizedRoiPct: number | null = null;
    if (openingBookEquity > 0 && yearFraction > 0) {
      const totalGain = closingBookEquity - openingBookEquity;
      const simpleRoi = totalGain / openingBookEquity;
      annualizedRoiPct = Math.round((simpleRoi / yearFraction) * 10000) / 100;
    }

    const statementId = `STMT-${partner.id.slice(0, 6).toUpperCase()}-${period.startDate}-${period.endDate}`;
    const generatedAt = new Date().toISOString();

    const rawPayload = JSON.stringify({
      statementId,
      businessId,
      partnerId: partner.id,
      period,
      closingBookEquity,
      closingMarketEquity,
      generatedAt,
    });

    const auditHash = crypto.createHash("sha256").update(rawPayload).digest("hex");

    return {
      statementId,
      businessId,
      partnerId: partner.id,
      partnerName: partner.name,
      partnerType: partner.partner_type,
      period,
      generatedAt,
      effectiveSharePct: currentEquity.effectiveSharePct,
      openingBookEquity: Math.round(openingBookEquity * 100) / 100,
      capitalContributed: Math.round(capitalContributed * 100) / 100,
      capitalWithdrawn: Math.round(capitalWithdrawn * 100) / 100,
      laborValueVested: currentEquity.vestedLaborValue,
      profitAllocated: Math.round(profitAllocated * 100) / 100,
      lossAllocated: Math.round(lossAllocated * 100) / 100,
      closingBookEquity: Math.round(closingBookEquity * 100) / 100,
      unrealizedValuationShare: currentEquity.unrealizedValuationShare,
      closingMarketEquity: Math.round(closingMarketEquity * 100) / 100,
      annualizedRoiPct,
      transactionCount: periodTxns.length,
      auditHash,
    };
  }
}
