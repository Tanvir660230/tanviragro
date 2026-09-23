"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { weightLogSchema } from "@/lib/validate";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { CattleDomainService } from "@/lib/services/cattle.service";
import { LivestockEventBus } from "@/lib/livestock/events";
import type { Cattle } from "@/types/database";

export type WeightLogFormState =
  | { error?: string; success?: boolean }
  | undefined;

export async function createWeightLog(
  _prevState: WeightLogFormState,
  formData: FormData
): Promise<WeightLogFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    const parsed = weightLogSchema.safeParse({
      cattle_id: (formData.get("cattle_id") as string)?.trim(),
      weight_kg: formData.get("weight_kg"),
      recorded_at: formData.get("recorded_at"),
      notes: (formData.get("notes") as string)?.trim() || null,
      girth_cm: formData.get("girth_cm") || null,
      length_cm: formData.get("length_cm") || null,
    });
    if (!parsed.success) return { error: parsed.error.issues?.[0]?.message ?? "Invalid input" };
    const { cattle_id, weight_kg, recorded_at, notes, girth_cm, length_cm } = parsed.data;

    const cattleRow = await assertResourceOwnership<Cattle>(supabase, "cattle", cattle_id, ctx.businessId);
    if (cattleRow.status !== "active") {
      return { error: "Cannot add weight logs to sold or deceased cattle" };
    }

    CattleDomainService.validateWeightLog(weight_kg, recorded_at);

    const { data: insertedLog, error } = await supabase.from("weight_logs").insert({
      cattle_id,
      weight_kg,
      recorded_at,
      notes,
      girth_cm,
      length_cm,
    }).select("id").single();

    if (error) return { error: "Failed to save. Please try again." };

    await LivestockEventBus.publish(
      "WeightRecorded",
      ctx.businessId,
      cattle_id,
      { weightKg: weight_kg, recordedAt: recorded_at, girthCm: girth_cm, lengthCm: length_cm },
      ctx.user?.id
    ).catch(() => {});

    revalidatePath(`/dashboard/cattle/${cattle_id}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record weight" };
  }
}

export type SaleFormState = { error?: string; success?: boolean } | undefined;

export async function recordSale(
  _prevState: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_SELL);

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

    const cattleRow = await assertResourceOwnership<Cattle>(supabase, "cattle", cattle_id, ctx.businessId);
    CattleDomainService.assertSaleEligibility(cattleRow.tag_id, cattleRow.status);

    const lockErr = await checkFinancialLock(supabase, ctx.businessId, sold_at);
    if (lockErr) return { error: lockErr };

    const { error: saleError } = await supabase.from("sales").insert({
      cattle_id,
      sold_at,
      sale_price_total,
      weight_at_sale_kg,
      buyer_name,
    });

    if (saleError) return { error: "Failed to record sale. Please try again." };

    const { error: updateError } = await supabase
      .from("cattle")
      .update({ status: "sold" })
      .eq("id", cattle_id);

    if (updateError) return { error: "Sale saved, but status update failed." };

    await LivestockEventBus.publish(
      "CattleSold",
      ctx.businessId,
      cattle_id,
      { salePriceTotal: sale_price_total, weightAtSaleKg: weight_at_sale_kg, soldAt: sold_at, buyerName: buyer_name },
      ctx.user?.id
    ).catch(() => {});

    revalidatePath(`/dashboard/cattle/${cattle_id}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record sale" };
  }
}

export async function revertSale(
  cattleId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.CATTLE_SELL);

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);

    const { error: delError } = await supabase.from("sales").delete().eq("cattle_id", cattleId);
    if (delError) return { error: "Failed to delete sale record" };

    const { error: upError } = await supabase.from("cattle").update({ status: "active" }).eq("id", cattleId);
    if (upError) return { error: "Failed to reset cattle status" };

    revalidatePath(`/dashboard/cattle/${cattleId}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to revert sale" };
  }
}

export async function deleteWeightLog(
  logId: string,
  cattleId: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);

    const { error } = await supabase.from("weight_logs").delete().eq("id", logId);
    if (error) return { error: "Failed to delete weight log" };

    revalidatePath(`/dashboard/cattle/${cattleId}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete weight log" };
  }
}

export async function updateRoughageOverride(
  cattleId: string,
  roughageKg: number | null
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.INVENTORY_CONSUME);

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);

    const { error } = await supabase
      .from("cattle")
      .update({ manual_feed_override: roughageKg !== null ? { roughageKg } : null })
      .eq("id", cattleId);

    if (error) return { error: "Failed to update roughage override" };

    revalidatePath(`/dashboard/cattle/${cattleId}`);
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update roughage override" };
  }
}

export type FeedLogFormState = { error?: string; success?: boolean } | undefined;

export async function logFeedConsumption(
  _prevState: FeedLogFormState,
  formData: FormData
): Promise<FeedLogFormState> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.INVENTORY_CONSUME);

    const cattle_id = (formData.get("cattle_id") as string)?.trim();
    const item_id = (formData.get("item_id") as string)?.trim();
    const qty = parseFloat(formData.get("qty") as string);
    const recorded_at = new Date().toISOString();

    if (!cattle_id) return { error: "Invalid cattle ID" };
    if (!item_id) return { error: "Feed item is required" };
    if (isNaN(qty) || qty <= 0) return { error: "Enter a valid quantity" };

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattle_id, ctx.businessId);
    await assertResourceOwnership(supabase, "inventory_items", item_id, ctx.businessId);

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
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to log feed consumption" };
  }
}

export async function logManualFeed(
  cattleId: string,
  itemId: string,
  qty: number
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.INVENTORY_CONSUME);

    if (!cattleId || !itemId || isNaN(qty) || qty <= 0) {
      return { error: "Invalid parameters" };
    }

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);
    await assertResourceOwnership(supabase, "inventory_items", itemId, ctx.businessId);

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
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to log feed consumption" };
  }
}

export async function toggleQuarantine(
  cattleId: string,
  isQuarantined: boolean
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.HEALTH_MANAGE);

    await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);

    const { error } = await supabase
      .from("cattle")
      .update({ is_quarantined: isQuarantined })
      .eq("id", cattleId);

    if (error) return { error: "Failed to update quarantine status" };
    
    revalidatePath(`/dashboard/cattle/${cattleId}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard");
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update quarantine status" };
  }
}