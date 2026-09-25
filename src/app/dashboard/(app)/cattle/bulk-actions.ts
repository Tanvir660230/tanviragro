"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { buildProtocolEvents, type HealthEventRow } from "@/lib/healthProtocol";
import { LivestockEventBus } from "@/lib/livestock/events";
import type { ValidatedLivestockRow } from "@/lib/livestock/bulk-import";
import type { CattleGender, CattleStatus, HealthEventType } from "@/types/database";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

export interface BulkImportResult {
  success: boolean;
  insertedCount: number;
  failedCount: number;
  error?: string;
  createdIds?: string[];
}

/**
 * Server action to process transactional bulk import of livestock records.
 */
export async function bulkImportLivestockAction(
  rows: ValidatedLivestockRow[]
): Promise<BulkImportResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_CREATE);
  if (permissionDenied) return { success: false, insertedCount: 0, failedCount: 0, error: permissionDenied };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, insertedCount: 0, failedCount: rows.length, error: "Authentication required" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { success: false, insertedCount: 0, failedCount: rows.length, error: "Failed to verify business account" };
  }
  if (!businessId) return { success: false, insertedCount: 0, failedCount: rows.length, error: "No active farm found" };

  const validRows = rows.filter((r) => r.isValid && r.tagId.trim().length > 0);
  if (validRows.length === 0) {
    return { success: false, insertedCount: 0, failedCount: rows.length, error: "No valid rows to import" };
  }

  // Check financial lock for earliest date
  const earliestDate = validRows.reduce((min, r) => (r.purchaseDate < min ? r.purchaseDate : min), validRows[0].purchaseDate);
  const lockError = await checkFinancialLock(supabase, businessId, earliestDate);
  if (lockError) {
    return { success: false, insertedCount: 0, failedCount: validRows.length, error: lockError };
  }

  // Check duplicate tags against DB
  const tagList = validRows.map((r) => r.tagId);
  const { data: existingRecords } = await supabase
    .from("cattle")
    .select("tag_id")
    .eq("business_id", businessId)
    .in("tag_id", tagList);

  if (existingRecords && existingRecords.length > 0) {
    const dupTags = existingRecords.map((c: { tag_id: string }) => c.tag_id).join(", ");
    return {
      success: false,
      insertedCount: 0,
      failedCount: validRows.length,
      error: `Import aborted: Tag IDs already exist in database: ${dupTags}`,
    };
  }

  // Prepare database rows
  const cattleRows = validRows.map((r) => {
    const dbGender: CattleGender = (r.gender === "cow" || r.gender === "heifer") ? "female" : "male";
    return {
      business_id: businessId!,
      tag_id: r.tagId,
      breed: r.breed || null,
      gender: dbGender,
      dob: r.dob || null,
      purchase_date: r.purchaseDate,
      purchase_price: r.purchasePrice || 0,
      initial_weight_kg: r.initialWeightKg || 1,
      status: "active" as CattleStatus,
      notes: r.notes || null,
    };
  });

  const { data: insertedCattle, error: insertError } = await supabase
    .from("cattle")
    .insert(cattleRows)
    .select("id, tag_id, purchase_date, initial_weight_kg");

  if (insertError || !insertedCattle) {
    return {
      success: false,
      insertedCount: 0,
      failedCount: validRows.length,
      error: "Failed to insert cattle records: " + (insertError?.message || "Unknown error"),
    };
  }

  // Insert initial baseline weight logs & ancillary costs
  const weightLogs = [];
  const costEntries = [];
  const allProtocolEvents: HealthEventRow[] = [];

  for (let i = 0; i < insertedCattle.length; i++) {
    const cow = insertedCattle[i];
    const sourceRow = validRows.find((r) => r.tagId.toLowerCase() === cow.tag_id.toLowerCase());

    if (cow.initial_weight_kg > 0) {
      weightLogs.push({
        business_id: businessId,
        cattle_id: cow.id,
        weight_kg: cow.initial_weight_kg,
        recorded_at: cow.purchase_date,
        notes: "Initial baseline weight on import",
      });
    }

    if (sourceRow && sourceRow.transportCost > 0) {
      costEntries.push({
        business_id: businessId,
        cattle_id: cow.id,
        type: "variable" as const,
        category: "transport",
        amount: sourceRow.transportCost,
        description: "Bulk Import: Freight / transport cost",
        recorded_at: cow.purchase_date,
      });
    }
    if (sourceRow && sourceRow.haatHasil > 0) {
      costEntries.push({
        business_id: businessId,
        cattle_id: cow.id,
        type: "variable" as const,
        category: "haat_hasil",
        amount: sourceRow.haatHasil,
        description: "Bulk Import: Haat Hasil / Market Tax fee",
        recorded_at: cow.purchase_date,
      });
    }

    const protocols = buildProtocolEvents(cow.id, businessId, cow.purchase_date);
    allProtocolEvents.push(...protocols);
  }

  if (weightLogs.length > 0) {
    await supabase.from("weight_logs").insert(weightLogs);
  }
  if (costEntries.length > 0) {
    await supabase.from("cost_entries").insert(costEntries);
  }
  if (allProtocolEvents.length > 0) {
    await supabase.from("health_events").insert(allProtocolEvents);
  }

  for (const cow of insertedCattle) {
    await LivestockEventBus.publish("CattleRegistered", businessId, cow.id, {
      tagId: cow.tag_id,
      bulkImport: true,
    });
  }

  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });   // cattle, costs or status changed: cash and the balance sheet
  revalidatePath("/dashboard");

  return {
    success: true,
    insertedCount: insertedCattle.length,
    failedCount: rows.length - insertedCattle.length,
    createdIds: insertedCattle.map((c) => c.id),
  };
}

/**
 * Server action to execute batch movement of multiple cattle to a target pen.
 */
export async function bulkBatchMovementAction(
  cattleIds: string[],
  targetPenId: string | null,
  farmId?: string | null
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_EDIT);
  if (permissionDenied) return { success: false, updatedCount: 0, error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, updatedCount: 0, error: "Authentication required" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { success: false, updatedCount: 0, error: "Failed to verify business account" };
  }
  if (!businessId) return { success: false, updatedCount: 0, error: "No active farm found" };

  if (!cattleIds || cattleIds.length === 0) {
    return { success: false, updatedCount: 0, error: "No animals selected for batch transfer" };
  }

  const updatePayload: { pen_id?: string | null; farm_id?: string | null } = {};
  if (targetPenId !== undefined) updatePayload.pen_id = targetPenId;
  if (farmId) updatePayload.farm_id = farmId;

  const { error } = await supabase
    .from("cattle")
    .update(updatePayload)
    .in("id", cattleIds)
    .eq("business_id", businessId);

  if (error) {
    return { success: false, updatedCount: 0, error: "Failed to transfer animals: " + error.message };
  }

  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });   // cattle, costs or status changed: cash and the balance sheet
  revalidatePath("/dashboard/cattle/pens");

  return { success: true, updatedCount: cattleIds.length };
}

/**
 * Server action to execute batch health protocol administration (deworming, vaccination, etc.).
 */
export async function bulkBatchHealthAction(
  cattleIds: string[],
  eventType: "vaccination" | "deworming" | "checkup" | "treatment",
  eventName: string,
  eventDate: string,
  notes?: string,
  costPerHead?: number
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { success: false, insertedCount: 0, error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, insertedCount: 0, error: "Authentication required" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { success: false, insertedCount: 0, error: "Failed to verify business account" };
  }
  if (!businessId) return { success: false, insertedCount: 0, error: "No active farm found" };

  if (!cattleIds || cattleIds.length === 0) {
    return { success: false, insertedCount: 0, error: "No animals selected" };
  }

  const dbEventType: HealthEventType = eventType === "vaccination" ? "vaccine" : eventType;

  const healthEvents: HealthEventRow[] = cattleIds.map((cid) => ({
    business_id: businessId!,
    cattle_id: cid,
    title: eventName,
    event_type: dbEventType,
    scheduled_at: eventDate,
    notes: notes || `Batch health event: ${eventName}`,
  }));

  const { error: healthError } = await supabase.from("health_events").insert(healthEvents);
  if (healthError) {
    return { success: false, insertedCount: 0, error: "Failed to log batch health events: " + healthError.message };
  }

  if (costPerHead && costPerHead > 0) {
    const costEntries = cattleIds.map((cid) => ({
      business_id: businessId!,
      cattle_id: cid,
      type: "variable" as const,
      category: "medical",
      amount: costPerHead,
      description: `Batch Health Treatment: ${eventName}`,
      recorded_at: eventDate,
    }));
    await supabase.from("cost_entries").insert(costEntries);
  }

  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });   // cattle, costs or status changed: cash and the balance sheet
  return { success: true, insertedCount: cattleIds.length };
}

/**
 * Server action to execute batch status transition (e.g. quarantine, active).
 */
export async function bulkBatchStatusAction(
  cattleIds: string[],
  status: "active" | "quarantined" | "sold" | "dead",
  notes?: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_EDIT);
  if (permissionDenied) return { success: false, updatedCount: 0, error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, updatedCount: 0, error: "Authentication required" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { success: false, updatedCount: 0, error: "Failed to verify business account" };
  }
  if (!businessId) return { success: false, updatedCount: 0, error: "No active farm found" };

  if (!cattleIds || cattleIds.length === 0) {
    return { success: false, updatedCount: 0, error: "No animals selected" };
  }

  const { error } = await supabase
    .from("cattle")
    .update({ status: status as CattleStatus, ...(notes ? { notes } : {}) })
    .in("id", cattleIds)
    .eq("business_id", businessId);

  if (error) {
    return { success: false, updatedCount: 0, error: "Failed to update status: " + error.message };
  }

  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });   // cattle, costs or status changed: cash and the balance sheet
  return { success: true, updatedCount: cattleIds.length };
}
