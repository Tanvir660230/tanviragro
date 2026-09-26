import type { Partner } from "@/types/database";
import type { PartnerValidationResult } from "./types";

/**
 * Input checks for partners and partner entries. Every money figure (shares, profit, loss,
 * account value) comes from lib/partners/position.ts — not from here.
 */
export class PartnerEngine {
  public static validatePartner(params: {
    name: string;
    partnerType: string;
    shareMode: string;
    profitSharePct: number;
    existingPartners: Partner[];
    editingPartnerId?: string;
  }): PartnerValidationResult {
    const errors: string[] = [];
    if (!params.name.trim()) errors.push("Partner name is required");
    if (!["capital", "labor", "hybrid"].includes(params.partnerType)) {
      errors.push("Invalid partner type. Must be capital, labor, or hybrid");
    }
    if (params.shareMode === "manual") {
      if (isNaN(params.profitSharePct) || params.profitSharePct < 0 || params.profitSharePct > 100) {
        errors.push("Profit share percentage must be between 0% and 100%");
      }
      const currentManualSum = params.existingPartners
        .filter((p) => p.share_mode === "manual" && p.id !== params.editingPartnerId)
        .reduce((s, p) => s + (Number(p.profit_share_pct) || 0), 0);
      if (currentManualSum + params.profitSharePct > 100) {
        errors.push(`Total manual profit share exceeds 100% (currently ${currentManualSum.toFixed(1)}% allocated)`);
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  public static validateTransaction(params: {
    partnerId: string;
    type: string;
    amount: number;
    recordedAt: string;
  }): PartnerValidationResult {
    const errors: string[] = [];
    if (!params.partnerId) errors.push("Partner is required");
    if (!Number.isFinite(params.amount) || params.amount <= 0) errors.push("Amount must be a positive number greater than 0");
    if (!["investment", "withdrawal", "profit", "loss_allocation"].includes(params.type)) errors.push("Invalid transaction type");
    if (!params.recordedAt || isNaN(Date.parse(params.recordedAt))) errors.push("Valid transaction date is required");
    return { isValid: errors.length === 0, errors };
  }
}
