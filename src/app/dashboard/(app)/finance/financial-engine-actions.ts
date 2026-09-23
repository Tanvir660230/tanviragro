"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import {
  LivestockCostAllocationEngine,
  BiologicalAssetValuationEngine,
  FinancialControlEngine,
  JournalEngine,
  type AllocationMethod,
  type TargetScope,
  type AllocationCandidate,
} from "@/lib/financial";

/**
 * Record a direct livestock cost with multi-dimensional allocation options
 */
export async function recordDirectCostAction(data: {
  amount: number;
  category: string;
  costType: "fixed" | "variable";
  entryClass: "expense" | "asset";
  recordedAt: string;
  description?: string;
  cattleId?: string;
  penId?: string;
  farmId?: string;
  allocationMethod?: AllocationMethod;
}) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    if (!data.amount || data.amount <= 0) return { error: "Amount must be a positive number" };
    if (!data.category) return { error: "Category is required" };
    if (!data.recordedAt) return { error: "Date is required" };

    const { data: locks } = await (supabase as any)
      .from("financial_period_locks")
      .select("*")
      .eq("business_id", ctx.businessId)
      .eq("is_locked", true);

    if (locks && locks.length > 0) {
      FinancialControlEngine.validatePeriodNotLocked(
        data.recordedAt,
        locks.map((l: any) => ({
          id: l.id,
          businessId: l.business_id,
          lockName: l.lock_name,
          startDate: l.start_date,
          endDate: l.end_date,
          isLocked: l.is_locked,
          lockedAt: l.locked_at,
        }))
      );
    }

    const { data: inserted, error: costErr } = await (supabase as any)
      .from("cost_entries")
      .insert({
        business_id: ctx.businessId,
        amount: data.amount,
        category: data.category,
        type: data.costType || "variable",
        entry_class: data.entryClass || "expense",
        recorded_at: data.recordedAt,
        description: data.description || null,
        cattle_id: data.cattleId || null,
      })
      .select("id")
      .single();

    if (costErr) return { error: costErr.message };

    const journal = JournalEngine.createCostEntryJournal({
      businessId: ctx.businessId,
      costId: inserted.id,
      amount: data.amount,
      category: data.category,
      entryClass: data.entryClass,
      date: data.recordedAt,
      description: data.description,
      userId: ctx.user.id,
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });

    return { success: true, costId: inserted.id, journalRef: journal.referenceNumber };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record direct cost" };
  }
}


/**
 * Run proportional overhead / labor / feed batch cost allocation across active livestock
 */
export async function runBatchCostAllocationAction(params: {
  sourceCategory: string;
  totalAmount: number;
  allocationMethod: AllocationMethod;
  targetScope: TargetScope;
  targetScopeId?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    if (params.totalAmount <= 0) return { error: "Allocation amount must be positive" };

    let query = (supabase as any)
      .from("cattle")
      .select("id, tag_id, farm_id, pen_id, breed, current_weight, created_at, status")
      .eq("business_id", ctx.businessId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (params.targetScope === "farm" && params.targetScopeId) {
      query = query.eq("farm_id", params.targetScopeId);
    } else if (params.targetScope === "pen" && params.targetScopeId) {
      query = query.eq("pen_id", params.targetScopeId);
    } else if (params.targetScope === "breed" && params.targetScopeId) {
      query = query.eq("breed", params.targetScopeId);
    }

    const { data: cattleList, error: fetchErr } = await query;
    if (fetchErr) return { error: fetchErr.message };
    if (!cattleList || cattleList.length === 0) {
      return { error: "No active livestock found matching target allocation scope" };
    }

    const candidates: AllocationCandidate[] = cattleList.map((c: any) => {
      const daysOnFeed = Math.max(1, Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)));
      return {
        cattleId: c.id,
        tagId: c.tag_id,
        farmId: c.farm_id,
        penId: c.pen_id,
        breed: c.breed,
        currentWeightKg: Number(c.current_weight) || 250,
        daysOnFeed,
        isActive: true,
      };
    });

    const distributed = LivestockCostAllocationEngine.calculateAllocation(
      params.totalAmount,
      params.allocationMethod,
      candidates
    );

    const allocationRun = LivestockCostAllocationEngine.createAllocationRun({
      businessId: ctx.businessId,
      sourceCategory: params.sourceCategory,
      allocationMethod: params.allocationMethod,
      totalAmount: params.totalAmount,
      targetScope: params.targetScope,
      targetScopeId: params.targetScopeId,
      recipientsCount: distributed.length,
      performedBy: ctx.user.id,
      notes: params.notes,
    });

    await (supabase as any).from("cost_allocations").insert({
      business_id: ctx.businessId,
      allocation_batch_number: allocationRun.allocationBatchNumber,
      source_category: allocationRun.sourceCategory,
      allocation_method: allocationRun.allocationMethod,
      total_amount: allocationRun.totalAmount,
      target_scope: allocationRun.targetScope,
      target_scope_id: allocationRun.targetScopeId,
      recipients_count: allocationRun.recipientsCount,
      applied_date: allocationRun.appliedDate,
      notes: allocationRun.notes,
      performed_by: ctx.user.id,
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });

    return {
      success: true,
      batchNumber: allocationRun.allocationBatchNumber,
      recipientsCount: distributed.length,
      sampleAllocations: distributed.slice(0, 5),
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to execute cost allocation" };
  }
}

/**
 * Execute IAS 41 Biological Asset Fair Value Revaluation for the entire active herd
 */
export async function runBiologicalAssetRevaluationAction(params: {
  marketRatePerKg: number;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    if (params.marketRatePerKg <= 0) return { error: "Market rate per kg must be greater than 0" };

    const { data: cattleList, error: fetchErr } = await (supabase as any)
      .from("cattle")
      .select("id, tag_id, current_weight, purchase_price, status")
      .eq("business_id", ctx.businessId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (fetchErr) return { error: fetchErr.message };
    if (!cattleList || cattleList.length === 0) return { error: "No active cattle found for revaluation" };

    const herdItems = cattleList.map((c: any) => ({
      cattleId: c.id,
      tagId: c.tag_id,
      currentWeightKg: Number(c.current_weight) || 250,
      bookValueCostBasis: Number(c.purchase_price) || 50000,
      isActive: true,
    }));

    const result = BiologicalAssetValuationEngine.calculateFairValueValuation({
      businessId: ctx.businessId,
      marketRatePerKg: params.marketRatePerKg,
      herd: herdItems,
      valuationNotes: params.notes,
      valuatorId: ctx.user.id,
    });

    await (supabase as any).from("biological_asset_valuations").insert({
      business_id: ctx.businessId,
      valuation_number: result.valuation.valuationNumber,
      valuation_date: result.valuation.valuationDate,
      valuation_basis: result.valuation.valuationBasis,
      market_rate_per_kg: result.valuation.marketRatePerKg,
      total_head_count: result.valuation.totalHeadCount,
      total_herd_weight_kg: result.valuation.totalHerdWeightKg,
      previous_book_value: result.valuation.previousBookValue,
      new_fair_value: result.valuation.newFairValue,
      unrealized_gain_loss: result.valuation.unrealizedGainLoss,
      is_posted: true,
      valuator_notes: result.valuation.valuatorNotes,
      approved_by: ctx.user.id,
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });

    return {
      success: true,
      valuation: result.valuation,
      journalRef: result.journalEntry.referenceNumber,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to run biological asset valuation" };
  }
}

/**
 * Manage Accounting Period Locks (Lock/Unlock)
 */
export async function toggleAccountingPeriodLockAction(params: {
  lockName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  reason?: string;
}) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    const { error } = await (supabase as any).from("financial_period_locks").upsert({
      business_id: ctx.businessId,
      lock_name: params.lockName,
      start_date: params.startDate,
      end_date: params.endDate,
      is_locked: params.isLocked,
      locked_by: ctx.user.id,
      locked_at: new Date().toISOString(),
      reason: params.reason || null,
    });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to toggle period lock" };
  }
}

/**
 * Reverses a posted journal entry with a Storno counter-entry
 */
export async function reverseFinancialJournalAction(params: {
  originalJournalId: string;
  reversalReason: string;
}) {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.COST_ENTRY_CREATE);

    if (!params.reversalReason?.trim()) {
      return { error: "Reversal reason is required for audit compliance" };
    }

    const { error } = await (supabase as any).from("financial_reversals").insert({
      business_id: ctx.businessId,
      original_journal_id: params.originalJournalId,
      reversal_journal_id: `je-rev-${Date.now()}`,
      reversal_reason: params.reversalReason,
      reversed_by: ctx.user.id,
    });

    if (error) return { error: error.message };

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to reverse journal entry" };
  }
}

