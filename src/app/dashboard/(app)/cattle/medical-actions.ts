"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFIFOUnitCost, getItemStock as getItemStockShared } from "@/lib/inventory-fifo";

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

  revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard/inventory");
  if (totalMedCost > 0) revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}
