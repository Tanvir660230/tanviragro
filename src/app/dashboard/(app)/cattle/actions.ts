"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { HealthEventType } from "@/types/database";
import { buildProtocolEvents } from "@/lib/healthProtocol";
import { createCattleSchema, validateDate, validatePositiveNumber, validateText } from "@/lib/validate";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type CattleFormState =
  | { error?: string; success?: boolean }
  | undefined;

export async function createCattle(
  _prevState: CattleFormState,
  formData: FormData
): Promise<CattleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = createCattleSchema.safeParse({
    tag_id:            (formData.get("tag_id") as string)?.trim(),
    breed:             (formData.get("breed") as string)?.trim() || null,
    gender:            formData.get("gender"),
    dob:               (formData.get("dob") as string) || null,
    purchase_date:     formData.get("purchase_date"),
    purchase_price:    formData.get("purchase_price"),
    initial_weight_kg: formData.get("initial_weight_kg"),
    transport_cost:    formData.get("transport_cost") || "0",
    haat_hasil:        formData.get("haat_hasil") || "0",
    notes:             (formData.get("notes") as string)?.trim() || null,
  });
  if (!parsed.success) return { error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
  const { tag_id, breed, gender, dob, purchase_date, purchase_price, initial_weight_kg, transport_cost, haat_hasil, notes } = parsed.data;

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { error: "Failed to verify business account" };
  }
  if (!businessId) return { error: "No active business found" };

  const lockError = await checkFinancialLock(supabase, businessId, purchase_date);
  if (lockError) return { error: lockError };

  const { data: newCattle, error } = await supabase
    .from("cattle")
    .insert({
      business_id: businessId,
      tag_id,
      breed,
      gender,
      dob,
      purchase_date,
      purchase_price,
      initial_weight_kg,
      status: "active",
      notes,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return { error: `Tag ID "${tag_id}" is already in use` };
    return { error: "Failed to save. Please try again." };
  }

  // Insert transport and haat costs if provided
  const costsToInsert = [];
  if (transport_cost > 0) {
    costsToInsert.push({
      business_id: businessId,
      cattle_id: newCattle.id,
      type: "variable" as const,
      category: "transport",
      amount: transport_cost,
      description: "Transport cost during purchase",
      recorded_at: purchase_date,
    });
  }
  if (haat_hasil > 0) {
    costsToInsert.push({
      business_id: businessId,
      cattle_id: newCattle.id,
      type: "variable" as const,
      category: "haat_hasil",
      amount: haat_hasil,
      description: "Haat tax / Hasil during purchase",
      recorded_at: purchase_date,
    });
  }
  
  if (costsToInsert.length > 0) {
    const { error: costError } = await supabase.from("cost_entries").insert(costsToInsert);
    if (costError) {
      // Roll back the cattle row so data stays consistent
      await supabase.from("cattle").delete().eq("id", newCattle.id);
      return { error: "Failed to save purchase costs. Please try again." };
    }
  }

  // Auto-schedule health protocol events for the new cattle
  const protocolEvents = buildProtocolEvents(newCattle.id, businessId, purchase_date);
  if (protocolEvents.length > 0) {
    const { error: healthError } = await supabase.from("health_events").insert(protocolEvents);
    if (healthError) {
      // Roll back cattle and costs
      await supabase.from("cattle").delete().eq("id", newCattle.id);
      return { error: "Failed to create health schedule. Please try again." };
    }
  }

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkCreateCattle(
  entries: {
    tag_id: string;
    breed: string | null;
    gender: "male" | "female";
    dob: string | null;
    purchase_date: string;
    purchase_price: number;
    initial_weight_kg: number;
    notes: string | null;
  }[]
): Promise<{ error?: string; count?: number }> {
  if (!entries.length) return { count: 0 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let businessId: string | null = null;
  try {
    businessId = await getCurrentBusinessId(supabase);
  } catch {
    return { error: "Failed to verify business account" };
  }
  if (!businessId) return { error: "No active business found" };

  // Check financial lock against the earliest purchase date in the batch
  const earliestDate = entries.reduce((min, e) => e.purchase_date < min ? e.purchase_date : min, entries[0].purchase_date);
  const lockError = await checkFinancialLock(supabase, businessId, earliestDate);
  if (lockError) return { error: lockError };

  // Validate individual entries
  const tagsInPayload = new Set<string>();
  let rowIndex = 1;
  for (const e of entries) {
    if (!e.tag_id || e.tag_id.length > 30) return { error: `Row ${rowIndex}: Tag ID is required and must be <= 30 chars` };
    if (!e.gender || !["male", "female"].includes(e.gender)) return { error: `Row ${rowIndex}: Gender is required` };
    if (!e.purchase_date) return { error: `Row ${rowIndex}: Purchase date is required` };
    if (isNaN(e.purchase_price) || e.purchase_price < 0) return { error: `Row ${rowIndex}: Valid purchase price required` };
    if (isNaN(e.initial_weight_kg) || e.initial_weight_kg <= 0) return { error: `Row ${rowIndex}: Valid initial weight required` };
    
    if (tagsInPayload.has(e.tag_id)) {
      return { error: `Duplicate Tag ID "${e.tag_id}" found within the uploaded data` };
    }
    tagsInPayload.add(e.tag_id);
    rowIndex++;
  }

  // Validate tags against DB
  const tags = entries.map(e => e.tag_id);
  const { data: existing } = await supabase.from("cattle").select("tag_id").in("tag_id", tags).eq("business_id", businessId).is("deleted_at", null);
  if (existing && existing.length > 0) {
    return { error: `Tags already in use: ${existing.map(e => e.tag_id).join(", ")}` };
  }

  const rows = entries.map(e => ({
    ...e,
    business_id: businessId,
    status: "active" as const
  }));

  const { data: inserted, error } = await supabase.from("cattle").insert(rows).select("id, purchase_date");
  if (error) return { error: "Failed to save bulk cattle" };

  // Create health events — roll back all cattle if this fails
  const allEvents = inserted.flatMap(c => buildProtocolEvents(c.id, businessId, c.purchase_date));
  if (allEvents.length > 0) {
    const { error: healthError } = await supabase.from("health_events").insert(allEvents);
    if (healthError) {
      const ids = inserted.map(c => c.id);
      await supabase.from("cattle").delete().in("id", ids);
      return { error: "Failed to create health schedules. Please try again." };
    }
  }

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return { count: inserted.length };
}

export async function markAsDeceased(
  id: string,
  notes?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("id, business_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };
  if (cattle.status === "dead") return { error: "Cattle is already marked as dead" };
  if (cattle.status === "sold") return { error: "Cannot mark a sold cattle as dead" };

  const { error } = await supabase
    .from("cattle")
    .update({
      status: "dead",
      notes: notes ? notes.trim() : undefined,
    })
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to update" };

  revalidatePath(`/dashboard/cattle/${id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function undoMarkAsDeceased(
  id: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("id, business_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };
  if (cattle.status !== "dead") return { error: "Cattle is not marked as dead" };

  const { error } = await supabase
    .from("cattle")
    .update({ status: "active" })
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to restore" };

  revalidatePath(`/dashboard/cattle/${id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function deleteCattle(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("cattle")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Failed to delete" };

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return {};
}

export type EditCattleFormState =
  | { error?: string; success?: boolean }
  | undefined;

export async function updateCattle(
  _prevState: EditCattleFormState,
  formData: FormData
): Promise<EditCattleFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const id = (formData.get("cattle_id") as string)?.trim();
  const tag_id = (formData.get("tag_id") as string)?.trim();
  const gender = formData.get("gender") as "male" | "female";
  const breed = (formData.get("breed") as string)?.trim() || null;
  const dob = (formData.get("dob") as string) || null;
  const purchase_date = (formData.get("purchase_date") as string)?.trim();
  const purchase_price = parseFloat(formData.get("purchase_price") as string);
  const initial_weight_kg = parseFloat(formData.get("initial_weight_kg") as string);
  const target_weight_raw = formData.get("target_weight_kg") as string;
  const target_weight_kg = target_weight_raw ? parseFloat(target_weight_raw) : null;
  const adg_raw = formData.get("expected_daily_gain_kg") as string;
  const expected_daily_gain_kg = adg_raw ? parseFloat(adg_raw) : null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!id) return { error: "Invalid cattle ID" };
  if (!tag_id) return { error: "Tag ID is required" };
  if (!gender || !["male", "female"].includes(gender)) return { error: "Gender is required" };
  if (!purchase_date) return { error: "Purchase date is required" };
  if (isNaN(purchase_price) || purchase_price < 0) return { error: "Valid purchase price is required" };
  if (isNaN(initial_weight_kg) || initial_weight_kg <= 0) return { error: "Valid initial weight is required" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: existing } = await supabase
    .from("cattle")
    .select("business_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.business_id !== businessId) return { error: "Unauthorized" };
  if (existing.status !== "active") return { error: "Cannot edit details of a sold or deceased cattle. This protects historical financial records." };

  // Check tag_id uniqueness within this business (excluding current cattle)
  const { data: tagConflict } = await supabase
    .from("cattle")
    .select("id")
    .eq("business_id", businessId)
    .eq("tag_id", tag_id)
    .neq("id", id)
    .maybeSingle();
  if (tagConflict) return { error: `Tag ID "${tag_id}" is already used by another cattle` };

  const { error } = await supabase
    .from("cattle")
    .update({ tag_id, gender, breed, dob, purchase_date, purchase_price, initial_weight_kg, target_weight_kg, expected_daily_gain_kg, notes })
    .eq("id", id);

  if (error) return { error: "Failed to update. Please try again." };

  revalidatePath(`/dashboard/cattle/${id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export interface BulkWeightEntry {
  cattle_id: string;
  weight_kg: number;
  recorded_at: string;
}

export async function bulkCreateWeightLogs(
  entries: BulkWeightEntry[]
): Promise<{ error?: string; count?: number }> {
  if (!entries.length) return { count: 0 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Validate each entry
  for (const e of entries) {
    if (!e.cattle_id) return { error: "Invalid cattle ID in bulk entries" };
    if (!Number.isFinite(e.weight_kg) || e.weight_kg <= 0)
      return { error: `Invalid weight for cattle ${e.cattle_id}` };
    if (!e.recorded_at) return { error: "Missing date in bulk entries" };
  }

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const ids = [...new Set(entries.map((e) => e.cattle_id))];
  const { data: owned } = await supabase
    .from("cattle")
    .select("id")
    .in("id", ids)
    .eq("business_id", businessId)
    .eq("status", "active");

  const ownedIds = new Set((owned ?? []).map((c: { id: string }) => c.id));
  const unauthorized = ids.filter((id) => !ownedIds.has(id));
  if (unauthorized.length) return { error: "One or more cattle not found or not active" };

  const rows = entries
    .filter((e) => ownedIds.has(e.cattle_id))
    .map((e) => ({ cattle_id: e.cattle_id, weight_kg: e.weight_kg, recorded_at: e.recorded_at }));

  const { error } = await supabase.from("weight_logs").insert(rows);
  if (error) return { error: "Failed to save weight logs" };

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return { count: rows.length };
}

export type BulkHealthFormState = { error?: string; success?: boolean; count?: number } | undefined;

export async function createBulkHealthEvents(
  _prevState: BulkHealthFormState,
  formData: FormData
): Promise<BulkHealthFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const title = (formData.get("title") as string)?.trim();
  const event_type = formData.get("event_type") as HealthEventType;
  const scheduled_at = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const cattleIdsRaw = formData.get("cattle_ids") as string;

  if (!title) return { error: "Title is required" };
  if (!scheduled_at) return { error: "Date is required" };
  if (!cattleIdsRaw) return { error: "Select at least one cattle" };

  const cattleIds = cattleIdsRaw.split(",").filter(Boolean);
  if (!cattleIds.length) return { error: "Select at least one cattle" };

  // Verify all cattle belong to this business
  const { data: cattleRows } = await supabase
    .from("cattle")
    .select("id, business_id")
    .in("id", cattleIds);

  const allOwned = (cattleRows ?? []).every(
    (c: { business_id: string }) => c.business_id === businessId
  );
  if ((cattleRows ?? []).length !== cattleIds.length || !allOwned)
    return { error: "Unauthorized" };

  const rows = cattleIds.map((cattle_id) => ({
    cattle_id,
    business_id: businessId,
    title,
    event_type,
    scheduled_at,
    notes,
  }));

  const { error } = await supabase.from("health_events").insert(rows);
  if (error) return { error: "Failed to create health events" };

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  return { success: true, count: rows.length };
}

export type BulkCostFormState = { error?: string; success?: boolean; count?: number } | undefined;

export async function createBulkCost(
  _prevState: BulkCostFormState,
  formData: FormData
): Promise<BulkCostFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const amountRaw = formData.get("amount") as string;
  const category = (formData.get("category") as string)?.trim() || "doctor_fee";
  const recorded_at = formData.get("recorded_at") as string;
  const description = (formData.get("description") as string)?.trim() || null;
  const cattleIdsRaw = formData.get("cattle_ids") as string;

  const totalAmount = parseFloat(amountRaw);

  if (isNaN(totalAmount) || totalAmount <= 0) return { error: "Invalid total amount" };
  if (!recorded_at) return { error: "Date is required" };
  if (!cattleIdsRaw) return { error: "Select at least one cattle" };

  const cattleIds = cattleIdsRaw.split(",").filter(Boolean);
  if (!cattleIds.length) return { error: "Select at least one cattle" };

  // Verify all cattle belong to this business
  const { data: cattleRows } = await supabase
    .from("cattle")
    .select("id, business_id")
    .in("id", cattleIds);

  const allOwned = (cattleRows ?? []).every(
    (c: { business_id: string }) => c.business_id === businessId
  );
  if ((cattleRows ?? []).length !== cattleIds.length || !allOwned)
    return { error: "Unauthorized cattle selection" };

  const amountPerCow = totalAmount / cattleIds.length;

  const rows = cattleIds.map((cattle_id) => ({
    cattle_id,
    business_id: businessId,
    type: "variable" as const,
    category,
    amount: amountPerCow,
    recorded_at,
    description: description ? `${description} (Batch Cost: ৳${totalAmount} / ${cattleIds.length})` : `Batch Cost: ৳${totalAmount} / ${cattleIds.length}`,
  }));

  const { error } = await supabase.from("cost_entries").insert(rows);
  if (error) return { error: "Failed to add batch cost" };

  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  return { success: true, count: rows.length };
}

// ── Qurbani Marking ──────────────────────────────────────────────────────────
export async function toggleQurbaniMark(
  cattleId: string,
  mark: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id, status")
    .eq("id", cattleId)
    .maybeSingle();

  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };
  if (cattle.status !== "active") return { error: "Cannot modify a sold or deceased cattle" };

  const { error } = await supabase
    .from("cattle")
    .update({ is_qurbani_marked: mark })
    .eq("id", cattleId);

  if (error) return { error: "আপডেট ব্যর্থ হয়েছে" };

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/qurbani");
  return {};
}

// ── Insurance update ──────────────────────────────────────────────────────────
export async function updateInsurance(
  cattleId: string,
  data: {
    insurance_provider: string | null;
    insurance_amount: number | null;
    insurance_expiry: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id, status")
    .eq("id", cattleId)
    .maybeSingle();

  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };
  if (cattle.status !== "active") return { error: "Cannot modify a sold or deceased cattle" };

  const { error } = await supabase
    .from("cattle")
    .update(data)
    .eq("id", cattleId);

  if (error) return { error: "আপডেট ব্যর্থ হয়েছে" };
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/compliance");
  return {};
}
