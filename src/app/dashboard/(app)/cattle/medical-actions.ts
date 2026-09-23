"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFIFOUnitCost, getItemStock as getItemStockShared } from "@/lib/inventory-fifo";
import { LivestockEventBus } from "@/lib/livestock/events";

import { HealthEngine } from "@/lib/livestock/health-engine";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import type {
  ClinicalVisitRecord,
  HealthAlert,
  HealthCertificateSummary,
  VitalSigns,
  PrescriptionItem,
} from "@/lib/livestock/types";
import type { UserRole } from "@/types/database";

export type TreatmentFormState = { error?: string; success?: boolean } | undefined;

export type CattleTreatment = {
  id: string;
  cattle_id: string;
  medicine_item_id: string | null;
  dose_administered: number | null;
  dose_unit: string | null;
  vet_fee: number;
  additional_medical_cost: number;
  diagnosis: string | null;
  notes: string | null;
  treated_at: string;
  created_at: string;
  inventory_items: { name: string; unit: string } | null;
};

// getOwnerBusinessId was removed. Using getCurrentBusinessId instead.

// getItemStock extracted to src/lib/inventory-fifo.ts
 
const getItemStock = (supabase: SupabaseClient<any>, item_id: string) => getItemStockShared(supabase, item_id);

// computeFIFOCost extracted to src/lib/inventory-fifo.ts
const computeFIFOCost = computeFIFOUnitCost;

export async function administerMedicine(
  _prev: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { error: "Business not found" };

  const cattle_id              = (formData.get("cattle_id") as string)?.trim();
  const medicine_item_id       = (formData.get("medicine_item_id") as string)?.trim() || null;
  const doseRaw                = formData.get("dose_administered") as string;
  const dose_administered      = doseRaw ? parseFloat(doseRaw) : null;
  const dose_unit              = (formData.get("dose_unit") as string)?.trim() || "ml";
  const vet_fee                = parseFloat(formData.get("vet_fee") as string) || 0;
  const additional_medical_cost = parseFloat(formData.get("additional_medical_cost") as string) || 0;
  if (!Number.isFinite(vet_fee) || vet_fee < 0) return { error: "Vet fee must be zero or positive" };
  if (!Number.isFinite(additional_medical_cost) || additional_medical_cost < 0) return { error: "Additional medical cost must be zero or positive" };
  const diagnosis              = (formData.get("diagnosis") as string)?.trim() || null;
  const notes                  = (formData.get("notes") as string)?.trim() || null;
  const treated_at             = (formData.get("treated_at") as string)?.trim();

  if (!cattle_id) return { error: "Cattle ID is required" };
  if (!treated_at) return { error: "Treatment date is required" };

  // IDOR: verify cattle belongs to this business
  const { data: cattle } = await supabase
    .from("cattle")
    .select("id, business_id, tag_id")
    .eq("id", cattle_id)
    .maybeSingle();
  if (!cattle || cattle.business_id !== bizId) return { error: "Unauthorized" };

  // Validate + preflight check medicine stock
  let fifo_unit_cost: number | null = null;
  if (medicine_item_id) {
    if (dose_administered == null || isNaN(dose_administered) || dose_administered <= 0) {
      return { error: "Dose must be greater than 0 when a medicine is selected" };
    }
    // Verify medicine item belongs to this business
    const { data: medItem } = await supabase
      .from("inventory_items")
      .select("business_id")
      .eq("id", medicine_item_id)
      .maybeSingle();
    if (!medItem || medItem.business_id !== bizId) return { error: "Unauthorized medicine item" };

    const stock = await getItemStock(supabase, medicine_item_id);
    if (dose_administered > stock + 0.0001) {
      return { error: `Insufficient medicine stock. Required: ${dose_administered.toFixed(3)}, available: ${stock.toFixed(3)} ${dose_unit}` };
    }
    try { fifo_unit_cost = await computeFIFOCost(supabase, medicine_item_id, dose_administered); } catch { /* non-fatal */ }
  }

  // 1. Insert treatment record
  const { data: treatment, error: treatErr } = await supabase
    .from("cattle_treatments")
    .insert({
      cattle_id,
      medicine_item_id: medicine_item_id || null,
      dose_administered: medicine_item_id ? dose_administered : null,
      dose_unit,
      vet_fee,
      additional_medical_cost,
      diagnosis,
      notes,
      treated_at,
    })
    .select("id")
    .single();
  if (treatErr || !treatment) return { error: "Failed to save treatment record" };

  // 2. Deduct medicine from inventory
  if (medicine_item_id && dose_administered && dose_administered > 0) {
    const { error: invErr } = await supabase.from("inventory_transactions").insert({
      item_id: medicine_item_id,
      type: "consumption",
      qty: dose_administered,
      unit_cost: fifo_unit_cost,
      cattle_id,
      recorded_at: treated_at,
      notes: `Treatment${diagnosis ? `: ${diagnosis}` : ""}`,
    });
    if (invErr) {
      await supabase.from("cattle_treatments").delete().eq("id", treatment.id);
      return { error: "Failed to deduct medicine from inventory. Please try again." };
    }
  }

  // 3. Log vet fee + additional costs as cost_entry (non-blocking if fails)
  const totalMedCost = vet_fee + additional_medical_cost;
  if (totalMedCost > 0) {
    await supabase.from("cost_entries").insert({
      business_id: bizId,
      cattle_id,
      type: "variable",
      category: "Medical/Vet Fee",
      amount: totalMedCost,
      recorded_at: treated_at,
      description: `Cattle #${cattle.tag_id} — ${diagnosis || "medical treatment"}`,
    });
  }

  await LivestockEventBus.publish(
    "TreatmentRecorded",
    bizId,
    cattle_id,
    { treatmentId: treatment.id, diagnosis, vetFee: vet_fee, treatedAt: treated_at },
    user.id
  ).catch(() => {});

  revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/inventory");
  if (totalMedCost > 0) revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

/**
 * Records a comprehensive clinical visit, including vitals, diagnosis, prescriptions,
 * automated inventory deduction, financial cost linkage, and follow-up scheduling.
 */
export async function recordClinicalVisitAction(
  payload: ClinicalVisitRecord & { actorRole?: UserRole }
): Promise<{ success: boolean; visitId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { success: false, error: "Business not found" };

  const userRole: UserRole = payload.actorRole || "veterinarian";

  try {
    HealthEngine.validateMedicalPermission("prescribe", userRole);
    if (payload.vitals) HealthEngine.validateVitals(payload.vitals);

    const { data: cattle, error: cattleErr } = await supabase
      .from("cattle")
      .select("id, business_id, tag_id, status, is_quarantined, pen_id, withdrawal_end_date")
      .eq("id", payload.cattleId)
      .eq("business_id", bizId)
      .single();

    if (cattleErr || !cattle) return { success: false, error: "Animal not found" };

    const lockErr = await checkFinancialLock(supabase, bizId, payload.visitDate);
    if (lockErr) return { success: false, error: lockErr };

    const medicineDeductions: { itemId: string; dose: number; unit: string; fifoCost: number | null; withdrawalDays: number }[] = [];
    let maxWithdrawalDays = 0;

    for (const item of payload.prescriptions || []) {
      if (item.medicineItemId && item.dose > 0) {
        const stock = await getItemStock(supabase, item.medicineItemId);
        if (item.dose > stock + 0.0001) {
          return {
            success: false,
            error: `Insufficient inventory for ${item.medicineName}. Requested: ${item.dose} ${item.doseUnit}, Available: ${stock.toFixed(3)} ${item.doseUnit}`,
          };
        }
        let fifoCost: number | null = null;
        try { fifoCost = await computeFIFOCost(supabase, item.medicineItemId, item.dose); } catch { /* non-fatal */ }
        medicineDeductions.push({ itemId: item.medicineItemId, dose: item.dose, unit: item.doseUnit, fifoCost, withdrawalDays: item.withdrawalDays || 0 });
        if (item.withdrawalDays > maxWithdrawalDays) maxWithdrawalDays = item.withdrawalDays;
      }
    }

    for (const item of payload.prescriptions || []) {
      const { error: treatErr } = await supabase.from("cattle_treatments").insert({
        cattle_id: payload.cattleId,
        medicine_item_id: item.medicineItemId || null,
        dose_administered: item.dose || null,
        dose_unit: item.doseUnit || "ml",
        vet_fee: payload.vetFeeBdt || 0,
        additional_medical_cost: (payload.labTestFeeBdt || 0) + (payload.additionalCostBdt || 0),
        diagnosis: `${payload.primaryDiagnosis}${item.route ? ` [${item.route}]` : ""}`,
        notes: payload.recommendations || item.notes || null,
        treated_at: payload.visitDate,
      });
      if (treatErr) throw treatErr;
    }

    if (!payload.prescriptions || payload.prescriptions.length === 0) {
      await supabase.from("cattle_treatments").insert({
        cattle_id: payload.cattleId,
        medicine_item_id: null,
        dose_administered: null,
        dose_unit: "ml",
        vet_fee: payload.vetFeeBdt || 0,
        additional_medical_cost: (payload.labTestFeeBdt || 0) + (payload.additionalCostBdt || 0),
        diagnosis: payload.primaryDiagnosis,
        notes: payload.recommendations || null,
        treated_at: payload.visitDate,
      });
    }

    for (const deduction of medicineDeductions) {
      await supabase.from("inventory_transactions").insert({
        item_id: deduction.itemId,
        type: "consumption",
        qty: deduction.dose,
        unit_cost: deduction.fifoCost,
        cattle_id: payload.cattleId,
        recorded_at: payload.visitDate,
        notes: `Prescription: ${payload.primaryDiagnosis}`,
      });
    }

    const totalMedicalCost = (payload.vetFeeBdt || 0) + (payload.labTestFeeBdt || 0) + (payload.additionalCostBdt || 0);
    if (totalMedicalCost > 0) {
      await supabase.from("cost_entries").insert({
        business_id: bizId,
        cattle_id: payload.cattleId,
        type: "variable",
        category: "Medical/Vet Fee",
        amount: totalMedicalCost,
        recorded_at: payload.visitDate,
        description: `Clinical Visit #${cattle.tag_id} — ${payload.primaryDiagnosis} (Dr. ${payload.veterinarianName})`,
      });
    }

    const cattleUpdates: Record<string, unknown> = {};
    if (payload.requiresQuarantine && !cattle.is_quarantined) {
      cattleUpdates.is_quarantined = true;
      if (payload.targetPenId) cattleUpdates.pen_id = payload.targetPenId;
    } else if (!payload.requiresQuarantine && cattle.is_quarantined && payload.visitType === "discharge") {
      cattleUpdates.is_quarantined = false;
    }

    if (maxWithdrawalDays > 0) {
      const calculatedEndDate = HealthEngine.calculateWithdrawalPeriod(payload.visitDate, maxWithdrawalDays);
      if (!cattle.withdrawal_end_date || calculatedEndDate > cattle.withdrawal_end_date) {
        cattleUpdates.withdrawal_end_date = calculatedEndDate;
      }
    }

    if (Object.keys(cattleUpdates).length > 0) {
      await supabase.from("cattle").update(cattleUpdates as any).eq("id", payload.cattleId).eq("business_id", bizId);
    }

    if (payload.nextFollowUpDate) {
      await supabase.from("health_events").insert({
        cattle_id: payload.cattleId,
        business_id: bizId,
        title: `Follow-up: ${payload.primaryDiagnosis}`,
        event_type: "checkup",
        scheduled_at: payload.nextFollowUpDate,
        notes: `Clinical follow-up scheduled by Dr. ${payload.veterinarianName}`,
      });
    }

    await LivestockEventBus.publish(
      "TreatmentRecorded",
      bizId,
      payload.cattleId,
      { primaryDiagnosis: payload.primaryDiagnosis, veterinarian: payload.veterinarianName, totalCost: totalMedicalCost, visitDate: payload.visitDate },
      user.id
    ).catch(() => {});

    revalidatePath(`/dashboard/cattle/${payload.cattleId}`);
    revalidatePath("/dashboard/cattle/health");
    revalidatePath("/dashboard/inventory");
    if (totalMedicalCost > 0) revalidatePath("/dashboard/finance");
    revalidateTag("accounting", { expire: 0 });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record clinical visit" };
  }
}

/**
 * Generates an official health certificate summary.
 */
export async function generateHealthCertificateAction(
  cattleId: string,
  weightKg: number,
  certifyingVet: string
): Promise<{ success: boolean; certificate?: HealthCertificateSummary; error?: string }> {
  const supabase = await createClient();
  const bizId = await getCurrentBusinessId(supabase);
  if (!bizId) return { success: false, error: "Unauthorized" };

  try {
    const [cattleRes, eventsRes, treatRes] = await Promise.all([
      supabase
        .from("cattle")
        .select("id, tag_id, breed, gender, dob, purchase_date, status, is_quarantined, withdrawal_end_date")
        .eq("id", cattleId)
        .eq("business_id", bizId)
        .single(),
      supabase
        .from("health_events")
        .select("title, event_type, completed_at, scheduled_at")
        .eq("cattle_id", cattleId)
        .eq("business_id", bizId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("cattle_treatments")
        .select("diagnosis, treated_at")
        .eq("cattle_id", cattleId)
        .order("treated_at", { ascending: false }),
    ]);

    if (cattleRes.error || !cattleRes.data) {
      return { success: false, error: "Animal record not found" };
    }

    const cert = HealthEngine.compileHealthCertificate(
      cattleRes.data,
      weightKg,
      eventsRes.data || [],
      treatRes.data || [],
      certifyingVet
    );

    return { success: true, certificate: cert };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate health certificate",
    };
  }
}

