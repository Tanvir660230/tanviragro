"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import type { HealthEventType } from "@/types/database";

export type HealthFormState = { error?: string; success?: boolean } | undefined;

export async function createHealthEvent(
  _prev: HealthFormState,
  formData: FormData
): Promise<HealthFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cattleId = formData.get("cattle_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const eventType = formData.get("event_type") as HealthEventType;
  const scheduledAt = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

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

  const { error } = await supabase.from("health_events").insert({
    cattle_id: cattleId,
    business_id: businessId,
    title,
    event_type: eventType || "checkup",
    scheduled_at: scheduledAt,
    notes,
  });

  if (error) return { error: "Failed to save" };

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function completeHealthEvent(
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

  const { error } = await supabase
    .from("health_events")
    .update({ completed_at: new Date().toISOString().slice(0, 10) })
    .eq("id", eventId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to update" };

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function deleteHealthEvent(
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

  // Soft-delete: preserve compliance audit trail
  await supabase
    .from("health_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("business_id", businessId);

  revalidatePath(`/dashboard/cattle/${cattleId}`);
  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
