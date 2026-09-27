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
import { todayDhaka } from "@/lib/dates";

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

  // checked again here: a row needs a tag, a real purchase date and a weight (never a made-up 1 kg)
  const validRows = rows.filter((r) => r.isValid && r.tagId.trim().length > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(String(r.purchaseDate ?? "")) && String(r.purchaseDate) <= todayDhaka()
    && Number(r.initialWeightKg) > 0 && Number(r.purchasePrice ?? 0) >= 0);
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
      initial_weight_kg: r.initialWeightKg,
      // a weight typed into a sheet is taken as weighed (as on the add form)
      initial_weight_type: "measured" as const,
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

  // Costs and health protocol per animal. The purchase weight is the animal's own
  // initial_weight_kg — no separate weight log (the add form writes none; a second copy made
  // imported animals look weighed twice on the purchase day).
  const costEntries = [];
  const allProtocolEvents: HealthEventRow[] = [];

  for (let i = 0; i < insertedCattle.length; i++) {
    const cow = insertedCattle[i];
    const sourceRow = validRows.find((r) => r.tagId.toLowerCase() === cow.tag_id.toLowerCase());

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

  // the animals are in; say so if their costs or health plan could not be saved
  const warnings: string[] = [];
  if (costEntries.length > 0) {
    const { error } = await supabase.from("cost_entries").insert(costEntries);
    if (error) warnings.push(`transport / haat costs were not saved (${error.message})`);
  }
  if (allProtocolEvents.length > 0) {
    const { error } = await supabase.from("health_events").insert(allProtocolEvents);
    if (error) warnings.push(`the vaccine plan was not created (${error.message})`);
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
    ...(warnings.length ? { error: `Imported, but ${warnings.join("; ")}` } : {}),
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

  // given today or earlier = done (it used to be saved as a task still to do, so a past date
  // showed as "overdue" at once); a future date is a task to do
  const done = eventDate <= todayDhaka();
  const healthEvents: HealthEventRow[] = cattleIds.map((cid) => ({
    business_id: businessId!,
    cattle_id: cid,
    title: eventName,
    event_type: dbEventType,
    scheduled_at: eventDate,
    ...(done ? { completed_at: eventDate } : {}),
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
    const { error: costError } = await supabase.from("cost_entries").insert(costEntries);
    if (costError) {
      return { success: false, insertedCount: cattleIds.length, error: "The health records were saved, but the cost was not: " + costError.message };
    }
  }

  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });   // cattle, costs or status changed: cash and the balance sheet
  return { success: true, insertedCount: cattleIds.length };
}

/**
 * Batch quarantine on / off. Quarantine is a FLAG on an animal still on the farm (never a
 * status). "Sold" and "dead" are not batch statuses: a sale needs its price and date (the
 * sale dialog) and a death its date (markAsDeceased) — a bare status change broke the money.
 */
export async function bulkBatchStatusAction(
  cattleIds: string[],
  status: "active" | "quarantined" | "sold" | "dead",
  _notes?: string
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { success: false, updatedCount: 0, error: permissionDenied };
  if (status === "sold" || status === "dead") {
    return { success: false, updatedCount: 0, error: status === "sold" ? "Sell each animal from its page (price and date are needed)." : "Record deaths with “Mark dead” (the date is needed)." };
  }
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

  const { data, error } = await supabase
    .from("cattle")
    .update({ is_quarantined: status === "quarantined" })
    .in("id", cattleIds)
    .eq("business_id", businessId)
    .eq("status", "active")
    .select("id");

  if (error) {
    return { success: false, updatedCount: 0, error: "Failed to update: " + error.message };
  }

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return { success: true, updatedCount: (data ?? []).length };
}
