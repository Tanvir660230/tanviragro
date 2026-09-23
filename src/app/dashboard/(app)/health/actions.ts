"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { LivestockEventBus } from "@/lib/livestock/events";
import type { HealthEventType } from "@/types/database";

export type HealthFormState = { error?: string; success?: boolean } | undefined;

export async function createHealthEventAction(
  _prev: HealthFormState,
  formData: FormData
): Promise<HealthFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cattleId = formData.get("cattle_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const eventType = (formData.get("event_type") as HealthEventType | "") || "checkup";
  const scheduledAt = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const completeNow = formData.get("complete_now") === "on";

  if (!cattleId) return { error: "Animal is required" };
  if (!title) return { error: "Title is required" };
  if (!scheduledAt) return { error: "Date is required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { data: eventData, error } = await supabase
    .from("health_events")
    .insert({
      cattle_id: cattleId,
      business_id: businessId,
      title,
      event_type: eventType,
      scheduled_at: scheduledAt,
      completed_at: completeNow ? scheduledAt : null,
      notes,
    })
    .select("id")
    .single();

  if (error) return { error: "Failed to save health event" };

  await LivestockEventBus.publish(
    "HealthEventScheduled",
    businessId,
    cattleId,
    { eventId: eventData?.id, title, eventType, scheduledAt },
    user.id
  ).catch(() => {});

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/records");
  revalidatePath("/dashboard/health/timeline");
  revalidatePath(`/dashboard/health/animals/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });

  return { success: true };
}

export async function completeHealthEventAction(
  eventId: string,
  cattleId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("health_events")
    .update({ completed_at: today })
    .eq("id", eventId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to update" };

  await LivestockEventBus.publish(
    "VaccinationCompleted",
    businessId,
    cattleId,
    { eventId, completedAt: today },
    user.id
  ).catch(() => {});

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/records");
  revalidatePath("/dashboard/health/vaccinations");
  revalidatePath("/dashboard/health/timeline");
  revalidatePath(`/dashboard/health/animals/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });

  return {};
}

export async function deleteHealthEventAction(
  eventId: string,
  cattleId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  await supabase
    .from("health_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("business_id", businessId);

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/records");
  revalidatePath("/dashboard/health/timeline");
  revalidatePath(`/dashboard/health/animals/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/cattle");
  revalidateTag("accounting", { expire: 0 });

  return {};
}

// ── Disease Actions ──────────────────────────────────────────────────────────

export type DiseaseFormState = { error?: string; success?: boolean } | undefined;

export async function recordDiseaseAction(
  _prev: DiseaseFormState,
  formData: FormData
): Promise<DiseaseFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const cattleId = formData.get("cattle_id") as string;
  const diseaseName = (formData.get("disease_name") as string)?.trim();
  const diagnosisDate = formData.get("diagnosis_date") as string;
  const severity = (formData.get("severity") as string) || "mild";
  const isContagious = formData.get("is_contagious") === "on";
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!cattleId) return { error: "Animal is required" };
  if (!diseaseName) return { error: "Disease name is required" };
  if (!diagnosisDate) return { error: "Diagnosis date is required" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await (supabase as any).from("disease_records").insert({
    business_id: businessId,
    cattle_id: cattleId,
    disease_name: diseaseName,
    diagnosis_date: diagnosisDate,
    severity,
    is_contagious: isContagious,
    status: "active",
    notes,
    symptoms: [],
  });

  if (error) return { error: "Failed to record disease: " + error.message };

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/diseases");
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  return { success: true };
}

export async function resolveDiseaseAction(
  diseaseId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await (supabase as any)
    .from("disease_records")
    .update({ status: "recovered", resolution_date: today, updated_at: new Date().toISOString() })
    .eq("id", diseaseId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to resolve disease" };

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/diseases");
  return {};
}


// ── Quarantine Actions ───────────────────────────────────────────────────────

export async function admitQuarantineAction(
  cattleId: string,
  notes?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("cattle")
    .update({ is_quarantined: true, updated_at: new Date().toISOString() } as any)
    .eq("id", cattleId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to admit to quarantine" };

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/quarantine");
  revalidatePath("/dashboard/cattle");
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  return {};
}

export async function dischargeQuarantineAction(
  cattleId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("cattle")
    .update({ is_quarantined: false, updated_at: new Date().toISOString() } as any)
    .eq("id", cattleId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to discharge from quarantine" };

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/quarantine");
  revalidatePath("/dashboard/cattle");
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  return {};
}

// ── Mortality Action ─────────────────────────────────────────────────────────

export type MortalityFormState = { error?: string; success?: boolean } | undefined;

export async function recordMortalityAction(
  _prev: MortalityFormState,
  formData: FormData
): Promise<MortalityFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const cattleId = formData.get("cattle_id") as string;
  const deathDate = formData.get("death_date") as string;
  const causeOfDeath = (formData.get("cause_of_death") as string)?.trim();
  const postMortemNotes = (formData.get("post_mortem_notes") as string)?.trim() || null;
  const estimatedLoss = parseFloat(formData.get("estimated_casualty_loss_bdt") as string) || 0;
  const disposalMethod = (formData.get("disposal_method") as string) || "burial";

  if (!cattleId) return { error: "Animal is required" };
  if (!deathDate) return { error: "Death date is required" };
  if (!causeOfDeath) return { error: "Cause of death is required" };

  const { data: cattle } = await supabase.from("cattle").select("business_id, tag_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error: deathError } = await (supabase as any).from("cattle_death_records").insert({
    business_id: businessId,
    cattle_id: cattleId,
    death_date: deathDate,
    cause_of_death: causeOfDeath,
    post_mortem_notes: postMortemNotes,
    estimated_casualty_loss_bdt: estimatedLoss,
    disposal_method: disposalMethod,
  });
  if (deathError) return { error: "Failed to record death: " + deathError.message };

  await supabase.from("cattle").update({ status: "dead" } as any).eq("id", cattleId).eq("business_id", businessId);

  await LivestockEventBus.publish("CattleDeceased", businessId, cattleId, { causeOfDeath, deathDate }, user.id).catch(() => {});

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/mortality");
  revalidatePath("/dashboard/cattle");
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

