"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/constants/roles";
import { LivestockEventBus } from "@/lib/livestock/events";
import {
  GestationEngine,
  PedigreeEngine,
  type BreedingType,
  type EstrusIntensity,
  type PDMethod,
  type PDResult,
  type CalvingType,
  type DeliveryDifficulty,
  type BirthStatus,
} from "@/lib/reproduction";

export interface BreedingActionResult {
  success?: boolean;
  error?: string;
  recordId?: string;
  offspringIds?: string[];
  inbreedingRisk?: any;
}

export async function recordHeatAction(payload: {
  cattleId: string;
  detectedAtISO: string;
  heatType?: "natural" | "induced" | "sync_protocol";
  intensity?: EstrusIntensity;
  observedBy?: string;
  notes?: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    if (!payload.cattleId || !payload.detectedAtISO) {
      return { error: "Animal and detection time are required" };
    }

    const optimal = GestationEngine.calculateOptimalBreedingWindow(payload.detectedAtISO);

    const { data: record, error } = await (supabase as any)
      .from("heat_records")
      .insert({
        business_id: ctx.businessId,
        cattle_id: payload.cattleId,
        detected_at: payload.detectedAtISO,
        heat_type: payload.heatType || "natural",
        intensity: payload.intensity || "standing_heat",
        observed_by: payload.observedBy || null,
        optimal_breeding_start: optimal.startISO,
        optimal_breeding_end: optimal.endISO,
        status: "active",
        notes: payload.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    await (supabase as any).from("reproduction_reminders").insert({
      business_id: ctx.businessId,
      cattle_id: payload.cattleId,
      reference_id: record.id,
      reminder_type: "breeding_window",
      scheduled_for: optimal.startISO.slice(0, 10),
      notes: "Optimal insemination window opens for cow " + payload.cattleId,
    });

    revalidatePath("/dashboard/cattle/breeding");
    revalidatePath("/dashboard/cattle/" + payload.cattleId);
    return { success: true, recordId: record.id };
  } catch (err: any) {
    return { error: err.message || "Failed to record heat detection" };
  }
}

export async function recordBreedingAttemptAction(payload: {
  cowId: string;
  heatRecordId?: string;
  breedingType?: BreedingType;
  semenInventoryId?: string;
  sireId?: string;
  sireTagOrCode: string;
  sireBreed?: string;
  inseminationDate: string;
  inseminationTime?: string;
  technicianName?: string;
  technicianCostBdt?: number;
  strawCostBdt?: number;
  attemptNumberInCycle?: number;
  notes?: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    if (!payload.cowId || !payload.sireTagOrCode || !payload.inseminationDate) {
      return { error: "Cow, Sire, and Insemination Date are required" };
    }

    const { data: cow } = await (supabase as any)
      .from("cattle")
      .select("id, breed, tag_number")
      .eq("id", payload.cowId)
      .single();

    const expectedCalving = GestationEngine.calculateExpectedCalvingDate(
      payload.inseminationDate,
      cow?.breed || payload.sireBreed
    );
    const pdDate = GestationEngine.calculatePDCheckDate(payload.inseminationDate);
    const dryOff = GestationEngine.calculateDryOffDate(expectedCalving);
    const transitionDiet = GestationEngine.calculateTransitionDietDate(expectedCalving);

    const techCost = Number(payload.technicianCostBdt || 0);
    const strawCost = Number(payload.strawCostBdt || 0);
    const totalCost = techCost + strawCost;

    const { data: attempt, error } = await (supabase as any)
      .from("breeding_attempts")
      .insert({
        business_id: ctx.businessId,
        cow_id: payload.cowId,
        heat_record_id: payload.heatRecordId || null,
        breeding_type: payload.breedingType || "AI",
        semen_inventory_id: payload.semenInventoryId || null,
        sire_id: payload.sireId || null,
        sire_tag_or_code: payload.sireTagOrCode,
        sire_breed: payload.sireBreed || null,
        insemination_date: payload.inseminationDate,
        insemination_time: payload.inseminationTime || null,
        technician_name: payload.technicianName || null,
        technician_cost_bdt: techCost,
        straw_cost_bdt: strawCost,
        total_breeding_cost_bdt: totalCost,
        attempt_number_in_cycle: payload.attemptNumberInCycle || 1,
        status: "inseminated",
        pd_check_scheduled_date: pdDate,
        pd_result: "pending",
        expected_calving_date: expectedCalving,
        dry_off_date: dryOff,
        transition_diet_date: transitionDiet,
        notes: payload.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    if (payload.semenInventoryId) {
      const { data: sem } = await (supabase as any)
        .from("semen_inventory")
        .select("straws_in_stock, straws_used")
        .eq("id", payload.semenInventoryId)
        .single();
      if (sem) {
        await (supabase as any)
          .from("semen_inventory")
          .update({
            straws_in_stock: Math.max(0, (sem.straws_in_stock || 1) - 1),
            straws_used: (sem.straws_used || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.semenInventoryId);
      }
    }

    if (payload.heatRecordId) {
      await (supabase as any)
        .from("heat_records")
        .update({ status: "inseminated", updated_at: new Date().toISOString() })
        .eq("id", payload.heatRecordId);
    }

    await (supabase as any).from("reproduction_reminders").insert({
      business_id: ctx.businessId,
      cattle_id: payload.cowId,
      reference_id: attempt.id,
      reminder_type: "pd_check_due",
      scheduled_for: pdDate,
      notes: "Pregnancy Diagnosis due for cow " + (cow?.tag_number || payload.cowId),
    });

    await (supabase as any).from("breeding_records").insert({
      business_id: ctx.businessId,
      cow_id: payload.cowId,
      sire_id: payload.sireId || null,
      sire_tag_or_breed: payload.sireTagOrCode,
      insemination_date: payload.inseminationDate,
      insemination_type: payload.breedingType || "AI",
      technician_name: payload.technicianName || null,
      status: "inseminated",
      pd_check_date: pdDate,
      expected_calving_date: expectedCalving,
      dry_off_date: dryOff,
      notes: payload.notes || null,
    });

    LivestockEventBus.publish(
      "BreedingInseminated",
      ctx.businessId,
      payload.cowId,
      { attemptId: attempt.id, sire: payload.sireTagOrCode, method: payload.breedingType },
      ctx.user?.id
    );

    revalidatePath("/dashboard/cattle/breeding");
    revalidatePath("/dashboard/cattle/" + payload.cowId);
    return { success: true, recordId: attempt.id };
  } catch (err: any) {
    return { error: err.message || "Failed to record breeding attempt" };
  }
}

export async function recordPregnancyDiagnosisAction(payload: {
  attemptId: string;
  cowId: string;
  pdDate: string;
  pdResult: PDResult;
  pdMethod?: PDMethod;
  examinedBy?: string;
  riskLevel?: "normal" | "elevated" | "high";
  notes?: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    if (!payload.attemptId || !payload.pdResult) {
      return { error: "Attempt and diagnosis result are required" };
    }

    const isPregnant = payload.pdResult === "pregnant";
    const status = isPregnant ? "pregnancy_confirmed" : "pregnancy_failed";

    const { data: attempt, error } = await (supabase as any)
      .from("breeding_attempts")
      .update({
        pd_check_actual_date: payload.pdDate,
        pd_result: payload.pdResult,
        pd_method: payload.pdMethod || "rectal_palpation",
        pd_examined_by: payload.examinedBy || null,
        pregnancy_risk_level: payload.riskLevel || "normal",
        status,
        notes: payload.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.attemptId)
      .select()
      .single();

    if (error) throw error;

    if (isPregnant) {
      await (supabase as any).from("reproduction_reminders").insert([
        {
          business_id: ctx.businessId,
          cattle_id: payload.cowId,
          reference_id: payload.attemptId,
          reminder_type: "dry_off_due",
          scheduled_for: attempt.dry_off_date,
          notes: "Dry off cow 60 days before expected calving",
        },
        {
          business_id: ctx.businessId,
          cattle_id: payload.cowId,
          reference_id: payload.attemptId,
          reminder_type: "calving_due",
          scheduled_for: attempt.expected_calving_date,
          notes: "Expected delivery date",
        },
      ]);

      LivestockEventBus.publish(
        "PregnancyConfirmed",
        ctx.businessId,
        payload.cowId,
        { attemptId: payload.attemptId, expectedCalving: attempt.expected_calving_date },
        ctx.user?.id
      );
    }

    revalidatePath("/dashboard/cattle/breeding");
    revalidatePath("/dashboard/cattle/" + payload.cowId);
    return { success: true, recordId: payload.attemptId };
  } catch (err: any) {
    return { error: err.message || "Failed to record pregnancy diagnosis" };
  }
}

export async function recordCalvingAndRegisterOffspringAction(payload: {
  cowId: string;
  breedingAttemptId?: string;
  sireId?: string;
  sireNameOrCode?: string;
  calvingDate: string;
  calvingTime?: string;
  calvingType?: CalvingType;
  deliveryDifficulty?: DeliveryDifficulty;
  birthPresentation?: string;
  attendantName?: string;
  deliveryCostBdt?: number;
  vetFeeBdt?: number;
  placentaExpelledCleanly?: boolean;
  damPostpartumCondition?: "healthy" | "metritis" | "milk_fever" | "ketosis" | "injured" | "critical";
  notes?: string;
  calves: {
    tagNumber: string;
    name?: string;
    gender: "bull" | "heifer";
    birthWeightKg: number;
    birthStatus: BirthStatus;
    colostrumFedWithinHours?: number;
    colostrumQuality?: "excellent" | "good" | "fair" | "poor";
    navelDipped?: boolean;
    initialValuationBdt?: number;
    notes?: string;
  }[];
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    if (!payload.cowId || !payload.calvingDate || !payload.calves || payload.calves.length === 0) {
      return { error: "Dam, Calving Date, and at least one offspring details are required" };
    }

    const { data: calving, error: cErr } = await (supabase as any)
      .from("calving_records")
      .insert({
        business_id: ctx.businessId,
        breeding_attempt_id: payload.breedingAttemptId || null,
        cow_id: payload.cowId,
        sire_id: payload.sireId || null,
        sire_name_or_code: payload.sireNameOrCode || null,
        calving_date: payload.calvingDate,
        calving_time: payload.calvingTime || null,
        calving_type: payload.calvingType || (payload.calves.length > 1 ? "twin" : "single"),
        delivery_difficulty: payload.deliveryDifficulty || "unassisted",
        birth_presentation: payload.birthPresentation || "normal_anterior",
        attendant_name: payload.attendantName || null,
        delivery_cost_bdt: Number(payload.deliveryCostBdt || 0),
        vet_fee_bdt: Number(payload.vetFeeBdt || 0),
        placenta_expelled_cleanly: payload.placentaExpelledCleanly ?? true,
        dam_postpartum_condition: payload.damPostpartumCondition || "healthy",
        notes: payload.notes || null,
      })
      .select()
      .single();

    if (cErr) throw cErr;

    const { data: dam } = await (supabase as any)
      .from("cattle")
      .select("breed")
      .eq("id", payload.cowId)
      .single();

    const createdCalfIds = [];

    for (const calf of payload.calves) {
      const weaningTarget = GestationEngine.addDays(payload.calvingDate, 90);

      const { data: newCattle, error: cattleErr } = await (supabase as any)
        .from("cattle")
        .insert({
          business_id: ctx.businessId,
          tag_number: calf.tagNumber,
          name: calf.name || ("Calf " + calf.tagNumber),
          gender: calf.gender,
          breed: dam?.breed || "Crossbred",
          status: "healthy",
          weight: calf.birthWeightKg,
          purchase_price: 0,
          current_value: calf.initialValuationBdt || 15000,
          dam_id: payload.cowId,
          sire_id: payload.sireId || null,
          notes: "Born on farm from Dam. " + (calf.notes || ""),
        })
        .select()
        .single();

      if (cattleErr) throw cattleErr;
      createdCalfIds.push(newCattle.id);

      await (supabase as any).from("birth_offspring").insert({
        business_id: ctx.businessId,
        calving_record_id: calving.id,
        calf_cattle_id: newCattle.id,
        tag_number: calf.tagNumber,
        name: calf.name || null,
        gender: calf.gender,
        birth_weight_kg: calf.birthWeightKg,
        birth_status: calf.birthStatus,
        colostrum_fed_within_hours: calf.colostrumFedWithinHours || null,
        colostrum_quality: calf.colostrumQuality || null,
        navel_dipped: calf.navelDipped ?? true,
        initial_valuation_bdt: Number(calf.initialValuationBdt || 0),
        weaning_target_date: weaningTarget,
        notes: calf.notes || null,
      });

      await (supabase as any).from("weight_logs").insert({
        business_id: ctx.businessId,
        cattle_id: newCattle.id,
        weight_kg: calf.birthWeightKg,
        recorded_at: payload.calvingDate,
        notes: "Birth weight recorded at delivery",
      });

      await (supabase as any).from("reproduction_reminders").insert({
        business_id: ctx.businessId,
        cattle_id: newCattle.id,
        reference_id: calving.id,
        reminder_type: "weaning_due",
        scheduled_for: weaningTarget,
        notes: "Weaning due for calf " + calf.tagNumber + " (3 months)",
      });

      LivestockEventBus.publish(
        "CalfDelivered",
        ctx.businessId,
        newCattle.id,
        { damId: payload.cowId, birthWeight: calf.birthWeightKg, tag: calf.tagNumber },
        ctx.user?.id
      );
    }

    if (payload.breedingAttemptId) {
      await (supabase as any)
        .from("breeding_attempts")
        .update({ status: "calved", updated_at: new Date().toISOString() })
        .eq("id", payload.breedingAttemptId);
    }

    revalidatePath("/dashboard/cattle/breeding");
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/" + payload.cowId);
    return { success: true, recordId: calving.id, offspringIds: createdCalfIds };
  } catch (err: any) {
    return { error: err.message || "Failed to record calving and register offspring" };
  }
}

export async function recordSemenStockAction(payload: {
  bullCode: string;
  bullName: string;
  breed: string;
  strawCode: string;
  strawsInStock: number;
  costPerStrawBdt: number;
  supplier?: string;
  storageCanister?: string;
  motilityPercent?: number;
  notes?: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    if (!payload.bullCode || !payload.strawCode || payload.strawsInStock <= 0) {
      return { error: "Bull Code, Straw Code, and positive straw quantity are required" };
    }

    const { data, error } = await (supabase as any)
      .from("semen_inventory")
      .insert({
        business_id: ctx.businessId,
        bull_code: payload.bullCode,
        bull_name: payload.bullName,
        breed: payload.breed,
        straw_code: payload.strawCode,
        straws_in_stock: payload.strawsInStock,
        cost_per_straw_bdt: Number(payload.costPerStrawBdt || 0),
        supplier: payload.supplier || null,
        storage_canister: payload.storageCanister || null,
        motility_percent: payload.motilityPercent || null,
        notes: payload.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/dashboard/cattle/breeding");
    return { success: true, recordId: data.id };
  } catch (err: any) {
    return { error: err.message || "Failed to add semen inventory" };
  }
}

export async function recordWeaningAction(payload: {
  offspringId: string;
  weaningDate: string;
  weaningWeightKg: number;
  notes?: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    const { data: off, error } = await (supabase as any)
      .from("birth_offspring")
      .update({
        actual_weaning_date: payload.weaningDate,
        weaning_weight_kg: payload.weaningWeightKg,
        notes: payload.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.offspringId)
      .select()
      .single();

    if (error) throw error;

    if (off?.calf_cattle_id && payload.weaningWeightKg > 0) {
      await (supabase as any).from("weight_logs").insert({
        business_id: ctx.businessId,
        cattle_id: off.calf_cattle_id,
        weight_kg: payload.weaningWeightKg,
        recorded_at: payload.weaningDate,
        notes: "Weaning weight",
      });
    }

    revalidatePath("/dashboard/cattle/breeding");
    return { success: true, recordId: payload.offspringId };
  } catch (err: any) {
    return { error: err.message || "Failed to record weaning" };
  }
}

export async function evaluateInbreedingRiskAction(payload: {
  femaleId: string;
  maleId: string;
}): Promise<BreedingActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_EDIT);

    const { data: herd } = await (supabase as any)
      .from("cattle")
      .select("id, tag_number, name, gender, breed, dam_id, sire_id")
      .eq("business_id", ctx.businessId);

    const animalMap = new Map();
    for (const c of herd || []) {
      animalMap.set(c.id, {
        id: c.id,
        tagNumber: c.tag_number,
        name: c.name,
        gender: c.gender,
        breed: c.breed,
        damId: c.dam_id,
        sireId: c.sire_id,
      });
    }

    const evaluation = PedigreeEngine.evaluateMatingCompatibility(payload.femaleId, payload.maleId, animalMap);
    return { success: true, inbreedingRisk: evaluation };
  } catch (err: any) {
    return { error: err.message || "Failed to evaluate inbreeding risk" };
  }
}

