"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { LifecycleEngine } from "@/lib/livestock/lifecycle-engine";
import { TimelineEngine } from "@/lib/livestock/timeline-engine";
import { LivestockEventBus } from "@/lib/livestock/events";
import type { CattleStatus } from "@/types/database";
import type {
  LifecycleTransitionRequest,
  LifecycleTransitionResult,
  UnifiedTimelineEvent,
  TimelineEventCategory,
} from "@/lib/livestock/types";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";

export interface LifecycleActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Executes a robust, validated, role-enforced livestock lifecycle state transition.
 */
export async function executeLifecycleTransitionAction(
  request: LifecycleTransitionRequest
): Promise<LifecycleTransitionResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_EDIT);
  if (permissionDenied) {
    return {
      success: false,
      previousStatus: "active",
      newStatus: request.targetStatus,
      cattleId: request.cattleId,
      transitionTimestamp: new Date().toISOString(),
      automatedActionsExecuted: [],
      error: permissionDenied,
    };
  }
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);

  if (!businessId) {
    return {
      success: false,
      previousStatus: "active",
      newStatus: request.targetStatus,
      cattleId: request.cattleId,
      transitionTimestamp: new Date().toISOString(),
      automatedActionsExecuted: [],
      error: "Authentication failed or business not found.",
    };
  }

  // 1. Fetch current animal profile
  const { data: cattle, error: fetchErr } = await supabase
    .from("cattle")
    .select("id, tag_id, status, is_quarantined, purchase_date, withdrawal_end_date, farm_id, pen_id")
    .eq("id", request.cattleId)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !cattle) {
    return {
      success: false,
      previousStatus: "active",
      newStatus: request.targetStatus,
      cattleId: request.cattleId,
      transitionTimestamp: new Date().toISOString(),
      automatedActionsExecuted: [],
      error: "Animal record not found.",
    };
  }

  const currentStatus = cattle.status as CattleStatus;
  const targetStatus = request.targetStatus;
  const automatedActions: string[] = [];

  try {
    // 2. Validate state machine transition & RBAC
    LifecycleEngine.validateTransition(currentStatus, targetStatus, request.actorRole);

    // 3. Domain business assertions
    if (targetStatus === "sold") {
      LifecycleEngine.assertSaleEligibility(
        cattle.tag_id,
        currentStatus,
        cattle.withdrawal_end_date
      );
      if (request.effectiveDate) {
        const lockErr = await checkFinancialLock(supabase, businessId, request.effectiveDate);
        if (lockErr) throw new Error(lockErr);
      }
    }

    if (targetStatus === "dead") {
      LifecycleEngine.assertDeathEligibility(cattle.tag_id, currentStatus);
    }

    if (request.effectiveDate) {
      LifecycleEngine.assertDateSanity(null, cattle.purchase_date, request.effectiveDate);
    }

    // 4. Perform database updates
    const updates: Record<string, any> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === "quarantined") {
      updates.is_quarantined = true;
    } else if (targetStatus === "active" && cattle.is_quarantined) {
      updates.is_quarantined = false;
    }

    if (request.notes) {
      updates.notes = request.notes;
    }

    const { error: updateErr } = await (supabase as any)
      .from("cattle")
      .update(updates)
      .eq("id", cattle.id)
      .eq("business_id", businessId);

    if (updateErr) {
      throw new Error(`Failed to update livestock status: ${updateErr.message}`);
    }

    // 5. Execute Automation Hooks
    if (targetStatus === "dead") {
      // Cancel pending future health events to prevent phantom alerts
      const { data: cancelledEvents } = await supabase
        .from("health_events")
        .update({
          deleted_at: new Date().toISOString(),
          notes: "Auto-cancelled due to animal mortality",
        })
        .eq("cattle_id", cattle.id)
        .eq("business_id", businessId)
        .is("completed_at", null)
        .is("deleted_at", null)
        .select("id");

      if (cancelledEvents && cancelledEvents.length > 0) {
        automatedActions.push(`Cancelled ${cancelledEvents.length} pending scheduled health event(s)`);
      }

      // Record detailed mortality data if provided
      if (request.deathDetails) {
        await (supabase as any).from("cattle_death_records").upsert({
          business_id: businessId,
          cattle_id: cattle.id,
          death_date: request.effectiveDate || todayDhaka(),
          cause_of_death: request.deathDetails.causeOfDeath,
          post_mortem_notes: request.deathDetails.postMortemNotes || null,
          certified_by_vet_id: request.deathDetails.certifiedByVetId || null,
          estimated_casualty_loss_bdt: request.deathDetails.estimatedCasualtyLossBdt || 0,
          disposal_method: request.deathDetails.disposalMethod || "burial",
        });
        automatedActions.push("Created certified post-mortem mortality record");
      }
    }

    if (targetStatus === "sold") {
      // Invalidate future reminders
      await supabase
        .from("health_events")
        .update({
          deleted_at: new Date().toISOString(),
          notes: "Auto-cancelled due to animal sale",
        })
        .eq("cattle_id", cattle.id)
        .eq("business_id", businessId)
        .is("completed_at", null)
        .is("deleted_at", null);

      automatedActions.push("Cleared pending health reminders following sale");
    }

    // 6. Write to Immutable Audit Logs
    let auditLogId: string | undefined;
    const { data: auditLog } = await (supabase as any)
      .from("livestock_audit_logs")
      .insert({
        business_id: businessId,
        entity_type: "cattle",
        entity_id: cattle.id,
        action: "STATUS_CHANGE",
        actor_id: request.actorId,
        actor_role: request.actorRole,
        previous_state: { status: currentStatus, is_quarantined: cattle.is_quarantined },
        new_state: {
          status: targetStatus,
          reason: request.reason || null,
          effectiveDate: request.effectiveDate || null,
        },
      })
      .select("id")
      .single();

    if (auditLog) {
      auditLogId = auditLog.id;
    }

    // 7. Dispatch Domain Events
    await LivestockEventBus.publish("StatusChanged", businessId, cattle.id, {
      previousStatus: currentStatus,
      newStatus: targetStatus,
      tagId: cattle.tag_id,
      reason: request.reason,
    }, request.actorId);

    if (targetStatus === "dead") {
      await LivestockEventBus.publish("CattleDeceased", businessId, cattle.id, {
        tagId: cattle.tag_id,
        deathDate: request.effectiveDate,
      }, request.actorId);
    }

    revalidatePath("/dashboard/cattle");
    revalidatePath(`/dashboard/cattle/${cattle.id}`);

    return {
      success: true,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      cattleId: cattle.id,
      transitionTimestamp: new Date().toISOString(),
      automatedActionsExecuted: automatedActions,
      auditLogId,
    };
  } catch (err: any) {
    return {
      success: false,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      cattleId: cattle.id,
      transitionTimestamp: new Date().toISOString(),
      automatedActionsExecuted: automatedActions,
      error: err.message || "An unexpected error occurred during state transition.",
    };
  }
}

/**
 * Fetches compiled chronological lifecycle timeline for an animal.
 */
export async function getAnimalUnifiedTimelineAction(
  cattleId: string,
  category: TimelineEventCategory = "all"
): Promise<{ success: boolean; events: UnifiedTimelineEvent[]; error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_VIEW);
  if (permissionDenied) return { success: false, events: [], error: permissionDenied };
  const supabase = await createClient();
  const businessId = await getCurrentBusinessId(supabase);

  if (!businessId) {
    return { success: false, events: [], error: "Unauthorized" };
  }

  try {
    const [
      cattleRes,
      weightRes,
      healthRes,
      breedingRes,
      salesRes,
      deathRes,
      auditRes,
    ] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, tag_id, dob, purchase_date, purchase_price, initial_weight_kg, created_at, status, breed, gender")
        .eq("id", cattleId)
        .eq("business_id", businessId)
        .single(),
      supabase
        .from("weight_logs")
        .select("id, recorded_at, weight_kg, girth_cm, length_cm, notes")
        .eq("cattle_id", cattleId)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false }),
      (supabase as any)
        .from("health_events")
        .select("id, title, event_type, scheduled_at, completed_at, dosage, cost_bdt, notes")
        .eq("cattle_id", cattleId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: false }),
      (supabase as any)
        .from("breeding_records")
        .select("id, insemination_date, insemination_type, sire_tag_or_breed, pd_check_date, is_pregnant, actual_calving_date, notes")
        .eq("cow_id", cattleId)
        .eq("business_id", businessId)
        .order("insemination_date", { ascending: false }),
      (supabase as any)
        .from("cattle_sales")
        .select("id, sold_at, sale_price_total, buyer_name, weight_at_sale_kg")
        .eq("cattle_id", cattleId)
        .eq("business_id", businessId),
      (supabase as any)
        .from("cattle_death_records")
        .select("id, death_date, cause_of_death, post_mortem_notes, disposal_method, estimated_casualty_loss_bdt")
        .eq("cattle_id", cattleId)
        .eq("business_id", businessId)
        .maybeSingle(),
      (supabase as any)
        .from("livestock_audit_logs")
        .select("id, action, actor_id, actor_role, previous_state, new_state, timestamp")
        .eq("entity_id", cattleId)
        .eq("business_id", businessId)
        .order("timestamp", { ascending: false }),
    ]);

    if (cattleRes.error || !cattleRes.data) {
      return { success: false, events: [], error: "Animal not found." };
    }

    const compiled = TimelineEngine.compileUnifiedTimeline(
      {
        cattle: cattleRes.data,
        weightLogs: weightRes.data || [],
        healthEvents: healthRes.data || [],
        breedingRecords: breedingRes.data || [],
        salesData: salesRes.data || [],
        deathRecord: deathRes.data || null,
        auditLogs: (auditRes.data || []) as any,
      },
      category
    );

    return { success: true, events: compiled };
  } catch (err: any) {
    return { success: false, events: [], error: err.message || "Failed to compile timeline." };
  }
}
