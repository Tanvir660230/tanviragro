"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { buildProtocolEvents } from "@/lib/healthProtocol";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { LivestockEventBus } from "@/lib/livestock/events";
import type { AnimalWizardState } from "@/lib/validation/cattle-wizard";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";

export type WizardActionResult = {
  success?: boolean;
  error?: string;
  cattleId?: string;
};

export async function saveEnterpriseAnimalWizardAction(
  payload: AnimalWizardState,
  editAnimalId?: string
): Promise<WizardActionResult> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_CREATE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { error: "Failed to verify business account" };
  }
  if (!businessId) return { error: "No active business found" };

  const tagId = payload.identification.tagId?.trim();
  if (!tagId) return { error: "Ear Tag / ID is required" };

  const purchaseDate = payload.origin.originType === "purchase"
    ? payload.origin.purchaseDate
    : (payload.identification.dob || new Date().toISOString().split("T")[0]);

  const lockError = await checkFinancialLock(supabase, businessId, purchaseDate);
  if (lockError) return { error: lockError };

  // Tag uniqueness validation
  const query = supabase
    .from("cattle")
    .select("id")
    .eq("business_id", businessId)
    .eq("tag_id", tagId);

  if (editAnimalId) {
    query.neq("id", editAnimalId);
  }

  const { data: duplicate } = await query.maybeSingle();
  if (duplicate) {
    return { error: `Tag ID "${tagId}" is already registered in your business` };
  }

  if (editAnimalId) {
    // Update existing animal
    const { error: updateError } = await supabase
      .from("cattle")
      .update({
        tag_id: tagId,
        breed: payload.identification.breed || null,
        gender: payload.identification.gender,
        dob: payload.identification.dob || null,
        purchase_date: purchaseDate,
        purchase_price: payload.origin.purchasePrice || 0,
        initial_weight_kg: payload.origin.initialWeightKg || 1,
        notes: payload.notes?.trim() || null,
      })
      .eq("id", editAnimalId)
      .eq("business_id", businessId);

    if (updateError) {
      return { error: "Failed to update animal details: " + updateError.message };
    }

    revalidatePath(`/dashboard/cattle/${editAnimalId}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard");
    return { success: true, cattleId: editAnimalId };
  }

  // Create new animal
  const { data: newCattle, error: insertError } = await supabase
    .from("cattle")
    .insert({
      business_id: businessId,
      tag_id: tagId,
      breed: payload.identification.breed || null,
      gender: payload.identification.gender,
      dob: payload.identification.dob || null,
      purchase_date: purchaseDate,
      purchase_price: payload.origin.purchasePrice || 0,
      initial_weight_kg: payload.origin.initialWeightKg || 1,
      status: "active",
      notes: payload.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !newCattle) {
    return { error: "Failed to create animal record: " + (insertError?.message || "Unknown error") };
  }

  // Insert transport and haat / fees if any
  const costsToInsert = [];
  if (payload.financial.transportCost > 0) {
    costsToInsert.push({
      business_id: businessId,
      cattle_id: newCattle.id,
      type: "variable" as const,
      category: "transport",
      amount: payload.financial.transportCost,
      description: "Transport cost during acquisition",
      recorded_at: purchaseDate,
    });
  }
  if (payload.financial.haatHasil > 0) {
    costsToInsert.push({
      business_id: businessId,
      cattle_id: newCattle.id,
      type: "variable" as const,
      category: "haat_hasil",
      amount: payload.financial.haatHasil,
      description: "Market tax / Hasil fee during acquisition",
      recorded_at: purchaseDate,
    });
  }

  if (costsToInsert.length > 0) {
    await supabase.from("cost_entries").insert(costsToInsert);
  }

  // Schedule automatic health protocols for active animal
  const protocolEvents = buildProtocolEvents(newCattle.id, businessId, purchaseDate);
  if (protocolEvents.length > 0) {
    await supabase.from("health_events").insert(protocolEvents);
  }

  // Publish domain event
  await LivestockEventBus.publish(
    "CattleRegistered",
    businessId,
    newCattle.id,
    {
      tagId,
      purchasePrice: payload.origin.purchasePrice,
      initialWeightKg: payload.origin.initialWeightKg,
      category: payload.categoryStage.category,
    },
    user.id
  ).catch(() => {});

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/pens");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");

  return { success: true, cattleId: newCattle.id };
}
