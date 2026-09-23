"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { LivestockEventBus } from "@/lib/livestock/events";
import {
  VaccinationEngine,
  type AdministrationRoute,
  type ReactionSeverity,
  type ReactionType,
  type VaccineCode,
  type VaccinationExecutionParams,
} from "@/lib/livestock/vaccination-engine";
import type { HealthEventType } from "@/types/database";

export interface VaccinationActionResult {
  success?: boolean;
  error?: string;
  warning?: string;
  eventId?: string;
  boosterEventId?: string;
  affectedCattleCount?: number;
}

export async function administerVaccinationAction(
  payload: VaccinationExecutionParams
): Promise<VaccinationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business workspace not found" };

  const lockErr = await checkFinancialLock(supabase, businessId, payload.administeredAt);
  if (lockErr) return { error: lockErr };

  const { data: cattle, error: cattleErr } = await supabase
    .from("cattle")
    .select("id, tag_id, status, business_id")
    .eq("id", payload.cattleId)
    .single();

  if (cattleErr || !cattle || cattle.business_id !== businessId) {
    return { error: "Livestock record not found or access unauthorized" };
  }

  const totalCost = 0;

  if (payload.vaccineItemId) {
    const { data: item, error: itemErr } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("id", payload.vaccineItemId)
      .eq("business_id", businessId)
      .single();

    if (!itemErr && item) {
      const consumedQty = Math.max(0.1, payload.doseAdministeredMl);
      await supabase.from("inventory_transactions").insert({
        item_id: item.id,
        cattle_id: payload.cattleId,
        type: "consumption",
        qty: consumedQty,
        recorded_at: payload.administeredAt,
        notes: `Vaccination: ${payload.vaccineName} | Batch: ${payload.batchNumber || "N/A"} | Certifier: ${payload.administeredBy}`,
      });
    }
  }

  const notesDetail = [
    `Vaccine: ${payload.vaccineName}`,
    `Dose: ${payload.doseAdministeredMl}ml (${payload.route})`,
    payload.batchNumber ? `Batch #${payload.batchNumber}` : null,
    payload.manufacturer ? `Mfr: ${payload.manufacturer}` : null,
    `Administered by: ${payload.administeredBy}`,
    payload.notes ? `Notes: ${payload.notes}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const { data: insertedEvent, error: eventErr } = await supabase
    .from("health_events")
    .insert({
      business_id: businessId,
      cattle_id: payload.cattleId,
      title: `${payload.vaccineName} (Vaccinated)`,
      event_type: "vaccine",
      scheduled_at: payload.administeredAt,
      completed_at: payload.administeredAt,
      notes: notesDetail,
    })
    .select("id")
    .single();

  if (eventErr) {
    return { error: "Failed to log vaccination health event: " + eventErr.message };
  }

  await supabase.from("cattle_treatments").insert({
    cattle_id: payload.cattleId,
    medicine_item_id: payload.vaccineItemId || null,
    diagnosis: `Vaccination Protocol: ${payload.vaccineName}`,
    dose_administered: payload.doseAdministeredMl,
    dose_unit: "ml",
    vet_fee: 0,
    additional_medical_cost: totalCost,
    treated_at: payload.administeredAt,
    notes: `Batch: ${payload.batchNumber || "N/A"} | Certifier: ${payload.administeredBy}`,
  });

  let boosterEventId: string | undefined;
  if (payload.scheduleBooster) {
    const boosterDays = payload.boosterDays || 28;
    const boosterDueDate = VaccinationEngine.calculateNextBoosterDate(
      payload.administeredAt,
      boosterDays
    );

    const { data: boosterData } = await supabase
      .from("health_events")
      .insert({
        business_id: businessId,
        cattle_id: payload.cattleId,
        title: `${payload.vaccineName} — Booster Dose`,
        event_type: "vaccine",
        scheduled_at: boosterDueDate,
        notes: `Booster for dose given on ${payload.administeredAt}. Previous Batch #${payload.batchNumber || "N/A"}. Route: ${payload.route}`,
      })
      .select("id")
      .single();

    if (boosterData) {
      boosterEventId = boosterData.id;
    }
  }

  await LivestockEventBus.publish(
    "VaccinationCompleted",
    businessId,
    payload.cattleId,
    {
      vaccineName: payload.vaccineName,
      route: payload.route,
      batchNumber: payload.batchNumber,
      administeredBy: payload.administeredBy,
      doseMl: payload.doseAdministeredMl,
      boosterScheduled: payload.scheduleBooster,
    }
  );

  revalidatePath(`/dashboard/cattle/${payload.cattleId}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/compliance");
  revalidateTag("accounting", { expire: 0 });

  return {
    success: true,
    eventId: insertedEvent?.id,
    boosterEventId,
  };
}

export async function executeBatchVaccinationCampaignAction(payload: {
  cattleIds: string[];
  vaccineItemId?: string | null;
  vaccineName: string;
  vaccineCode?: VaccineCode;
  batchNumber?: string;
  manufacturer?: string;
  doseAdministeredMl: number;
  route: AdministrationRoute;
  administeredBy: string;
  administeredAt: string;
  scheduleBooster: boolean;
  boosterDays?: number;
}): Promise<VaccinationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business workspace not found" };

  if (!payload.cattleIds || payload.cattleIds.length === 0) {
    return { error: "No cattle selected for batch vaccination" };
  }

  const lockErr = await checkFinancialLock(supabase, businessId, payload.administeredAt);
  if (lockErr) return { error: lockErr };

  if (payload.vaccineItemId) {
    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("id", payload.vaccineItemId)
      .eq("business_id", businessId)
      .single();

    if (item) {
      const totalConsumed = payload.doseAdministeredMl * payload.cattleIds.length;
      await supabase.from("inventory_transactions").insert({
        item_id: item.id,
        type: "consumption",
        qty: totalConsumed,
        recorded_at: payload.administeredAt,
        notes: `Batch Campaign: ${payload.vaccineName} administered to ${payload.cattleIds.length} head. Batch: ${payload.batchNumber || "N/A"}`,
      });
    }
  }

  const notesDetail = [
    `Campaign: ${payload.vaccineName}`,
    `Dose: ${payload.doseAdministeredMl}ml (${payload.route})`,
    payload.batchNumber ? `Batch #${payload.batchNumber}` : null,
    `Administered by: ${payload.administeredBy}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const completedEvents = payload.cattleIds.map((cid) => ({
    business_id: businessId,
    cattle_id: cid,
    title: `${payload.vaccineName} (Vaccinated)`,
    event_type: "vaccine" as HealthEventType,
    scheduled_at: payload.administeredAt,
    completed_at: payload.administeredAt,
    notes: notesDetail,
  }));

  const { error: insertErr } = await supabase.from("health_events").insert(completedEvents);
  if (insertErr) {
    return { error: "Failed to insert batch health events: " + insertErr.message };
  }

  if (payload.scheduleBooster) {
    const boosterDueDate = VaccinationEngine.calculateNextBoosterDate(
      payload.administeredAt,
      payload.boosterDays || 28
    );
    const boosterEvents = payload.cattleIds.map((cid) => ({
      business_id: businessId,
      cattle_id: cid,
      title: `${payload.vaccineName} — Booster Dose`,
      event_type: "vaccine" as HealthEventType,
      scheduled_at: boosterDueDate,
      notes: `Campaign booster following dose on ${payload.administeredAt}. Batch: ${payload.batchNumber || "N/A"}`,
    }));

    await supabase.from("health_events").insert(boosterEvents);
  }

  const treatmentRows = payload.cattleIds.map((cid) => ({
    cattle_id: cid,
    medicine_item_id: payload.vaccineItemId || null,
    diagnosis: `Mass Vaccination: ${payload.vaccineName}`,
    dose_administered: payload.doseAdministeredMl,
    dose_unit: "ml",
    vet_fee: 0,
    additional_medical_cost: 0,
    treated_at: payload.administeredAt,
    notes: `Batch #${payload.batchNumber || "N/A"} | Executed by ${payload.administeredBy}`,
  }));

  await supabase.from("cattle_treatments").insert(treatmentRows);

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/compliance");
  revalidateTag("accounting", { expire: 0 });

  return {
    success: true,
    affectedCattleCount: payload.cattleIds.length,
  };
}
export async function recordVaccineAdverseEventAction(payload: {
  cattleId: string;
  cattleTag: string;
  vaccineName: string;
  batchNumber?: string;
  reactionType: ReactionType;
  severity: ReactionSeverity;
  symptoms: string;
  treatmentAdministered?: string;
  veterinarianNotes?: string;
  requiresQuarantine: boolean;
  followUpDate?: string;
}): Promise<VaccinationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business workspace not found" };

  const todayISO = new Date().toISOString().slice(0, 10);

  await supabase.from("cattle_treatments").insert({
    cattle_id: payload.cattleId,
    diagnosis: `Adverse Vaccine Reaction: ${payload.reactionType.toUpperCase()} (${payload.severity})`,
    dose_administered: null,
    dose_unit: undefined,
    vet_fee: 0,
    additional_medical_cost: 0,
    treated_at: todayISO,
    notes: `Vaccine: ${payload.vaccineName} | Symptoms: ${payload.symptoms} | Vet Notes: ${payload.veterinarianNotes || "N/A"}`,
  });

  const followUpAt = payload.followUpDate || todayISO;
  await supabase.from("health_events").insert({
    business_id: businessId,
    cattle_id: payload.cattleId,
    title: `Adverse Reaction Review: ${payload.reactionType}`,
    event_type: "treatment",
    scheduled_at: followUpAt,
    notes: `Severity: ${payload.severity} | Symptoms: ${payload.symptoms} | Treatment: ${payload.treatmentAdministered || "None"}`,
  });

  if (payload.requiresQuarantine) {
    await supabase
      .from("cattle")
      .update({ is_quarantined: true, updated_at: new Date().toISOString() })
      .eq("id", payload.cattleId)
      .eq("business_id", businessId);
  }

  revalidatePath(`/dashboard/cattle/${payload.cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/cattle");

  return { success: true };
}

