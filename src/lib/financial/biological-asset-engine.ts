import type { BiologicalAssetValuation, JournalEntry, JournalPostingLine } from "./types";
import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";
import { JournalEngine } from "./journal";

export interface BiologicalHerdItem {
  cattleId: string;
  tagId?: string;
  currentWeightKg: number;
  bookValueCostBasis: number;
  isActive: boolean;
}

export class BiologicalAssetValuationEngine {
  /**
   * Evaluates active biological herd fair value under IAS 41 Agriculture.
   */
  public static calculateFairValueValuation(params: {
    businessId: string;
    marketRatePerKg: number;
    herd: BiologicalHerdItem[];
    previousBookValue?: number;
    valuationNotes?: string;
    valuatorId?: string;
  }): {
    valuation: BiologicalAssetValuation;
    journalEntry: JournalEntry;
  } {
    const activeHerd = params.herd.filter((h) => h.isActive !== false);
    const totalHeadCount = activeHerd.length;
    const totalHerdWeightKg = Math.round(activeHerd.reduce((sum, h) => sum + Math.max(0, h.currentWeightKg || 0), 0) * 100) / 100;
    
    const calculatedFairValue = Math.round(totalHerdWeightKg * Math.max(0, params.marketRatePerKg) * 100) / 100;
    
    const previousBookVal = params.previousBookValue !== undefined
      ? params.previousBookValue
      : Math.round(activeHerd.reduce((sum, h) => sum + Math.max(0, h.bookValueCostBasis || 0), 0) * 100) / 100;

    const unrealizedGainLoss = Math.round((calculatedFairValue - previousBookVal) * 100) / 100;

    const timestamp = Date.now();
    const dateStr = new Date().toISOString().slice(0, 10);
    const valuationNumber = `BIO-VAL-${dateStr.replace(/-/g, "")}-${timestamp.toString().slice(-4)}`;

    const valuation: BiologicalAssetValuation = {
      id: `bio-val-${timestamp}`,
      businessId: params.businessId,
      valuationNumber,
      valuationDate: dateStr,
      valuationBasis: "market_weight_estimate",
      marketRatePerKg: params.marketRatePerKg,
      totalHeadCount,
      totalHerdWeightKg,
      previousBookValue: previousBookVal,
      newFairValue: calculatedFairValue,
      unrealizedGainLoss,
      journalEntryId: `je-bio-${timestamp}`,
      isPosted: true,
      valuatorNotes: params.valuationNotes,
      approvedBy: params.valuatorId,
      createdAt: new Date().toISOString(),
    };

    // Build Double-Entry Journal for IAS 41 Revaluation
    const absDiff = Math.abs(unrealizedGainLoss);
    let lines: JournalPostingLine[] = [];

    if (unrealizedGainLoss >= 0) {
      // Gain: Debit Livestock Inventory (1200), Credit Biological Asset Gain (4040)
      lines = [
        {
          accountCode: "1200",
          accountName: CHART_OF_ACCOUNTS["1200"].name,
          debit: absDiff,
          credit: 0,
          notes: `IAS 41 Biological Asset Fair Value Revaluation Surplus (${totalHeadCount} head, ${totalHerdWeightKg} kg)`,
        },
        {
          accountCode: "4040",
          accountName: CHART_OF_ACCOUNTS["4040"].name,
          debit: 0,
          credit: absDiff,
          notes: `Unrealized biological asset growth/market gain`,
        },
      ];
    } else {
      // Loss: Debit Biological Asset Loss (8020), Credit Livestock Inventory (1200)
      lines = [
        {
          accountCode: "8020",
          accountName: CHART_OF_ACCOUNTS["8020"].name,
          debit: absDiff,
          credit: 0,
          notes: `IAS 41 Biological Asset Fair Value Devaluation Loss`,
        },
        {
          accountCode: "1200",
          accountName: CHART_OF_ACCOUNTS["1200"].name,
          debit: 0,
          credit: absDiff,
          notes: `Inventory adjustment for market drop/devaluation`,
        },
      ];
    }

    const journalEntry = JournalEngine.validateJournalEntry({
      id: `je-bio-${timestamp}`,
      businessId: params.businessId,
      referenceNumber: valuationNumber,
      sourceModule: "cost_entry",
      sourceEntityId: valuation.id,
      transactionDate: dateStr,
      description: `IAS 41 Agricultural Biological Asset Valuation (${valuationNumber})`,
      lines,
      createdBy: params.valuatorId,
      createdAt: new Date().toISOString(),
    });

    return {
      valuation,
      journalEntry,
    };
  }
}
