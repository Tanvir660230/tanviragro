"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { LivestockEventBus } from "@/lib/livestock/events";
import { calculateAdgBetween, daysBetween } from "@/lib/growth/calculator";
import { type WeighingMethod, type MarketType } from "@/lib/growth/types";
import type { Cattle } from "@/types/database";

export interface RecordWeightPayload {
  cattleId: string;
  weightKg: number;
  recordedAt: string;
  notes?: string | null;
  girthCm?: number | null;
  lengthCm?: number | null;
  withersHeightCm?: number | null;
  bcs?: number | null;
  weighingMethod?: WeighingMethod;
  photoUrl?: string | null;
}

export interface GrowthActionResult {
  success?: boolean;
  error?: string;
  logId?: string;
  adgSinceLastKg?: number;
  daysSinceLast?: number;
  totalRecordsProcessed?: number;
}

export async function recordGrowthWeightAction(
  payload: RecordWeightPayload
): Promise<GrowthActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    const { cattleId, weightKg, recordedAt, notes, girthCm, lengthCm, withersHeightCm, bcs, weighingMethod, photoUrl } = payload;

    if (!cattleId || isNaN(weightKg) || weightKg <= 0 || weightKg > 3000) {
      return { error: "Invalid animal or weight measurement" };
    }

    if (!recordedAt) return { error: "Measurement date is required" };

    const lockErr = await checkFinancialLock(supabase, ctx.businessId, recordedAt);
    if (lockErr) return { error: lockErr };

    const cattleRow = await assertResourceOwnership<Cattle>(supabase, "cattle", cattleId, ctx.businessId);
    if (cattleRow.status !== "active") {
      return { error: "Cannot add weight logs to sold or deceased cattle" };
    }

    // Fetch previous weight log to calculate incremental ADG
    const { data: prevLog } = await supabase
      .from("weight_logs")
      .select("weight_kg, recorded_at")
      .eq("cattle_id", cattleId)
      .lte("recorded_at", recordedAt)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let adgSinceLast: number | undefined;
    let daysSinceLast: number | undefined;

    if (prevLog && prevLog.recorded_at !== recordedAt) {
      daysSinceLast = daysBetween(prevLog.recorded_at, recordedAt);
      adgSinceLast = calculateAdgBetween(prevLog.weight_kg, weightKg, prevLog.recorded_at, recordedAt);
    }

    const insertPayload: any = {
      cattle_id: cattleId,
      weight_kg: weightKg,
      recorded_at: recordedAt,
      notes: notes || null,
      heart_girth_cm: girthCm || null,
      body_length_cm: lengthCm || null,
      withers_height_cm: withersHeightCm || null,
      bcs: bcs || null,
      weighing_method: weighingMethod || "manual",
      photo_url: photoUrl || null,
      adg_since_last: adgSinceLast !== undefined ? adgSinceLast : null,
      days_since_last: daysSinceLast !== undefined ? daysSinceLast : null,
      recorded_by_user_id: ctx.user?.id || null,
    };

    const { data: inserted, error } = await supabase
      .from("weight_logs")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) return { error: `Failed to save weight: ${error.message}` };

    // Publish event
    await LivestockEventBus.publish(
      "WeightRecorded",
      ctx.businessId,
      cattleId,
      {
        weightKg,
        recordedAt,
        girthCm,
        lengthCm,
        bcs,
        adgSinceLast,
        weighingMethod: weighingMethod || "manual",
      },
      ctx.user?.id
    ).catch(() => {});

    revalidatePath(`/dashboard/cattle/${cattleId}`);
    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/growth");
    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard");

    return {
      success: true,
      logId: inserted?.id,
      adgSinceLastKg: adgSinceLast,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to record weight" };
  }
}

export async function bulkRecordGrowthWeightAction(
  entries: {
    cattleId: string;
    weightKg: number;
    recordedAt: string;
    bcs?: number | null;
    notes?: string | null;
    weighingMethod?: WeighingMethod;
  }[]
): Promise<GrowthActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    if (!entries || entries.length === 0) {
      return { error: "No entries provided" };
    }

    const validEntries = entries.filter((e) => e.cattleId && e.weightKg > 0 && e.weightKg < 3000);
    if (validEntries.length === 0) {
      return { error: "No valid weight records to save" };
    }

    const rows = validEntries.map((e) => ({
      cattle_id: e.cattleId,
      weight_kg: e.weightKg,
      recorded_at: e.recordedAt,
      bcs: e.bcs || null,
      notes: e.notes || null,
      weighing_method: e.weighingMethod || "bulk",
      recorded_by_user_id: ctx.user?.id || null,
    }));

    const { error } = await supabase.from("weight_logs").insert(rows as any);
    if (error) return { error: error.message };

    revalidatePath("/dashboard/cattle");
    revalidatePath("/dashboard/cattle/growth");
    revalidatePath("/dashboard/cattle/feed");
    revalidatePath("/dashboard");

    return { success: true, totalRecordsProcessed: validEntries.length };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Bulk weight logging failed" };
  }
}

export async function saveGrowthTargetAction(payload: {
  cattleId: string;
  targetWeightKg: number;
  targetAdgKg?: number | null;
  targetFinishDate?: string | null;
  targetMarketType?: MarketType;
  notes?: string | null;
}): Promise<GrowthActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    if (!payload.cattleId || payload.targetWeightKg <= 0) {
      return { error: "Invalid target parameters" };
    }

    await assertResourceOwnership<Cattle>(supabase, "cattle", payload.cattleId, ctx.businessId);

    // Upsert active target
    const targetPayload: any = {
      business_id: ctx.businessId,
      cattle_id: payload.cattleId,
      target_weight_kg: payload.targetWeightKg,
      target_adg_kg: payload.targetAdgKg || null,
      target_finish_date: payload.targetFinishDate || null,
      target_market_type: payload.targetMarketType || "beef",
      status: "active",
      notes: payload.notes || null,
    };

    const { error } = await supabase.from("growth_targets" as any).upsert(targetPayload, { onConflict: "cattle_id,deleted_at" } as any);

    if (error) return { error: error.message };

    revalidatePath(`/dashboard/cattle/${payload.cattleId}`);
    revalidatePath("/dashboard/cattle/growth");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to save growth target" };
  }
}

export async function acknowledgeGrowthAlertAction(
  cattleId: string,
  alertType: string,
  notes?: string
): Promise<GrowthActionResult> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.WEIGHT_LOG);

    const { error } = await supabase.from("growth_alert_acknowledgements" as any).insert({
      business_id: ctx.businessId,
      cattle_id: cattleId,
      alert_type: alertType,
      acknowledged_by: ctx.user?.id || null,
      notes: notes || null,
    } as any);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/cattle/growth");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to acknowledge alert" };
  }
}
