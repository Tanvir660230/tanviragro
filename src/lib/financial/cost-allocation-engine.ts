import type {
  AllocationMethod,
  TargetScope,
  AllocationCandidate,
  AllocatedResult,
  CostAllocationRun,
} from "./types";

export class LivestockCostAllocationEngine {
  /**
   * Distributes a total cost amount across multiple candidates using the specified allocation rule.
   * Guarantees exact rounding equilibrium (sum of allocated amounts === totalAmount).
   */
  public static calculateAllocation(
    totalAmount: number,
    method: AllocationMethod,
    candidates: AllocationCandidate[]
  ): AllocatedResult[] {
    const validCandidates = candidates.filter((c) => c.isActive !== false);
    if (validCandidates.length === 0 || totalAmount <= 0) {
      return [];
    }

    let weights: number[] = [];

    switch (method) {
      case "weight_proportional": {
        const totalWeight = validCandidates.reduce((sum, c) => sum + Math.max(0, c.currentWeightKg || 0), 0);
        if (totalWeight > 0) {
          weights = validCandidates.map((c) => Math.max(0, c.currentWeightKg || 0) / totalWeight);
        } else {
          // Fallback to equal split if weights are zero
          const count = validCandidates.length;
          weights = validCandidates.map(() => 1 / count);
        }
        break;
      }

      case "feed_days": {
        const totalDays = validCandidates.reduce((sum, c) => sum + Math.max(1, c.daysOnFeed || 1), 0);
        weights = validCandidates.map((c) => Math.max(1, c.daysOnFeed || 1) / totalDays);
        break;
      }

      case "head_count":
      case "equal_split":
      default: {
        const count = validCandidates.length;
        weights = validCandidates.map(() => 1 / count);
        break;
      }
    }

    let allocatedSum = 0;
    const results: AllocatedResult[] = [];

    for (let i = 0; i < validCandidates.length; i++) {
      const candidate = validCandidates[i];
      const weight = weights[i];
      const rawShare = Math.round(totalAmount * weight * 100) / 100;
      const proportionPct = Math.round(weight * 10000) / 100;

      allocatedSum += rawShare;
      results.push({
        cattleId: candidate.cattleId,
        tagId: candidate.tagId,
        allocatedAmount: rawShare,
        proportionPct,
      });
    }

    // Residual cent balance reconciliation (ensures total allocated exactly equals totalAmount)
    const diff = Math.round((totalAmount - allocatedSum) * 100) / 100;
    if (diff !== 0 && results.length > 0) {
      // Apply residual cent to the candidate with largest allocation
      let maxIdx = 0;
      for (let j = 1; j < results.length; j++) {
        if (results[j].allocatedAmount > results[maxIdx].allocatedAmount) {
          maxIdx = j;
        }
      }
      results[maxIdx].allocatedAmount = Math.round((results[maxIdx].allocatedAmount + diff) * 100) / 100;
    }

    return results;
  }

  /**
   * Generates a formal Cost Allocation Run record with batch numbering.
   */
  public static createAllocationRun(params: {
    businessId: string;
    sourceCategory: string;
    allocationMethod: AllocationMethod;
    totalAmount: number;
    targetScope: TargetScope;
    targetScopeId?: string;
    recipientsCount: number;
    performedBy?: string;
    notes?: string;
    journalEntryId?: string;
  }): CostAllocationRun {
    const timestamp = Date.now();
    const batchNumber = `ALLOC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${timestamp.toString().slice(-4)}`;

    return {
      id: `alloc-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
      businessId: params.businessId,
      allocationBatchNumber: batchNumber,
      sourceCategory: params.sourceCategory,
      allocationMethod: params.allocationMethod,
      totalAmount: Math.round(params.totalAmount * 100) / 100,
      targetScope: params.targetScope,
      targetScopeId: params.targetScopeId,
      recipientsCount: params.recipientsCount,
      appliedDate: new Date().toISOString().slice(0, 10),
      journalEntryId: params.journalEntryId,
      notes: params.notes,
      performedBy: params.performedBy,
      createdAt: new Date().toISOString(),
    };
  }
}
