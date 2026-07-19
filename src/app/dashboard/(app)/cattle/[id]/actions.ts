"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { weightLogSchema, validateDate, validatePositiveNumber, validateText } from "@/lib/validate";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type WeightLogFormState =
  | { error?: string; success?: boolean }
  | undefined;

export async function createWeightLog(
  _prevState: WeightLogFormState,
  formData: FormData
): Promise<WeightLogFormState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = weightLogSchema.safeParse({
    cattle_id:   (formData.get("cattle_id") as string)?.trim(),
    weight_kg:   formData.get("weight_kg"),
    recorded_at: formData.get("recorded_at"),
    notes:       (formData.get("notes") as string)?.trim() || null,
    girth_cm:    formData.get("girth_cm") || null,
    length_cm:   formData.get("length_cm") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
  const { cattle_id, weight_kg, recorded_at, notes, girth_cm, length_cm } = parsed.data;

  // Ownership check + status block
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattleRow } = await supabase
    .from("cattle")
    .select("status, business_id")
    .eq("id", cattle_id)
    .maybeSingle();
  if (!cattleRow || cattleRow.business_id !== businessId) return { error: "Unauthorized" };
  if (cattleRow.status !== "active")
    return { error: "Cannot add weight logs to sold or deceased cattle" };

  const { error } = await supabase.from("weight_logs").insert({
    cattle_id,
    weight_kg,
    recorded_at,
    notes,
    girth_cm,
    length_cm,
  });

  if (error) return { error: "Failed to save. Please try again." };

  revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return { success: true };
}

export type SaleFormState = { error?: string; success?: boolean } | undefined;

export async function recordSale(
  _prevState: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cattle_id = (formData.get("cattle_id") as string)?.trim();
  const sale_price_total = parseFloat(formData.get("sale_price_total") as string);
  const weight_at_sale_kg = parseFloat(formData.get("weight_at_sale_kg") as string);
  const sold_at = formData.get("sold_at") as string;
  const buyer_name = (formData.get("buyer_name") as string)?.trim() || null;

  if (!cattle_id) return { error: "Invalid cattle" };
  if (isNaN(sale_price_total) || sale_price_total <= 0)
    return { error: "Enter a valid sale price" };
  if (isNaN(weight_at_sale_kg) || weight_at_sale_kg <= 0)
    return { error: "Enter a valid weight at sale" };
  if (!sold_at) return { error: "Sale date is required" };

  // Ownership check + status validation
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattleRow } = await supabase
    .from("cattle")
    .select("status, business_id")
    .eq("id", cattle_id)
    .maybeSingle();
  if (!cattleRow || cattleRow.business_id !== businessId) return { error: "Unauthorized" };
  if (cattleRow.status === "sold") return { error: "This cattle has already been sold" };
  if (cattleRow.status === "dead") return { error: "Cannot record a sale for deceased cattle" };

  const lockError = await checkFinancialLock(supabase, businessId, sold_at);
  if (lockError) return { error: lockError };

  // Call the ACID transaction RPC
  const { data: saleId, error: rpcError } = await supabase.rpc("sell_cattle", {
    p_cattle_id: cattle_id,
    p_sale_price_total: sale_price_total,
    p_weight_at_sale_kg: weight_at_sale_kg,
    p_sold_at: sold_at,
    p_buyer_name: buyer_name
  });

  if (rpcError) {
    console.error("sell_cattle RPC error:", rpcError);
    return { error: "Sale could not be completed. Please ensure the cattle is active." };
  }

  revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function revertSale(
  cattleId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattleRow } = await supabase
    .from("cattle")
    .select("business_id, status")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattleRow || cattleRow.business_id !== businessId) return { error: "Unauthorized" };
  if (cattleRow.status !== "sold") return { error: "This cattle is not marked as sold" };

  // Fetch the most recent sale for this cattle
  const { data: saleRow } = await supabase
    .from("sales")
    .select("id, sold_at")
    .eq("cattle_id", cattleId)
    .is("deleted_at", null)
    .order("sold_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!saleRow) return { error: "No sale record found for this cattle" };

  const revertLockError = await checkFinancialLock(supabase, businessId, saleRow.sold_at);
  if (revertLockError) return { error: revertLockError };

  // Time-gate: only allow reversal within 7 days of the sale
  const saleDateMs = new Date(saleRow.sold_at).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - saleDateMs > sevenDaysMs) {
    return { error: "Sale cannot be reversed — it was recorded more than 7 days ago. Contact your accountant to correct this manually." };
  }

  // Call the ACID transaction RPC to revert the sale
  const { error: rpcError } = await supabase.rpc("revert_cattle_sale", {
    p_cattle_id: cattleId,
    p_sale_id: saleRow.id,
    p_reason: "Sale manually reverted by owner"
  });

  if (rpcError) {
    console.error("revert_cattle_sale RPC error:", rpcError);
    return { error: "Failed to revert the sale. Please try again." };
  }

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function deleteWeightLog(
  logId: string,
  cattleId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Ownership check — verify this cattle belongs to the user's business
  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase
    .from("cattle")
    .select("business_id")
    .eq("id", cattleId)
    .maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("weight_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", logId);
  if (error) return { error: "Failed to delete" };
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function updateRoughageOverride(
  cattleId: string,
  roughageKg: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id, manual_feed_override").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const existing = (cattle.manual_feed_override as Record<string, unknown> | null) ?? {};
  const updated = roughageKg === null
    ? Object.fromEntries(Object.entries(existing).filter(([k]) => k !== "roughageKg"))
    : { ...existing, roughageKg };

  const { error } = await supabase.from("cattle").update({ manual_feed_override: updated }).eq("id", cattleId);
  if (error) return { error: "Failed to save" };

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle");
  return {};
}

export type FeedLogFormState = { error?: string; success?: boolean } | undefined;

export async function logFeedConsumption(
  _prevState: FeedLogFormState,
  formData: FormData
): Promise<FeedLogFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cattle_id = (formData.get("cattle_id") as string)?.trim();
  const item_id = (formData.get("item_id") as string)?.trim();
  const qty = parseFloat(formData.get("qty") as string);
  const recorded_at = new Date().toISOString();

  if (!cattle_id) return { error: "Invalid cattle ID" };
  if (!item_id) return { error: "Feed item is required" };
  if (isNaN(qty) || qty <= 0) return { error: "Enter a valid quantity" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattle_id).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id,
    type: "consumption",
    qty,
    recorded_at,
    cattle_id,
  });

  if (error) return { error: "Failed to log feed consumption" };

  revalidatePath(`/dashboard/cattle/${cattle_id}`);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function logManualFeed(
  cattleId: string,
  itemId: string,
  qty: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!cattleId || !itemId || isNaN(qty) || qty <= 0) {
    return { error: "Invalid parameters" };
  }

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id: itemId,
    type: "consumption",
    qty,
    recorded_at: new Date().toISOString().slice(0, 10),
    cattle_id: cattleId,
    notes: "Manual Cow-Level Feed Log",
  });

  if (error) return { error: "Failed to log feed consumption" };

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return {};
}

export async function toggleQuarantine(
  cattleId: string,
  isQuarantined: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: cattle } = await supabase.from("cattle").select("business_id").eq("id", cattleId).maybeSingle();
  if (!cattle || cattle.business_id !== businessId) return { error: "Unauthorized" };

  const { error } = await supabase.from("cattle").update({ is_quarantined: isQuarantined }).eq("id", cattleId);
  if (error) return { error: "Failed to update quarantine status" };
  
  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard");
  return {};
}
