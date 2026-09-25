"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { actionPermissionError } from "@/lib/auth/action-guard";
import { PERMISSIONS } from "@/constants/roles";
import { todayDhaka } from "@/lib/dates";

export async function completeHealthEventHub(eventId: string): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { error } = await supabase
    .from("health_events")
    .update({ completed_at: todayDhaka() })
    .eq("id", eventId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to update" };

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/vaccinations");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteHealthEventHub(eventId: string): Promise<{ error?: string }> {
  const permissionDenied = await actionPermissionError(PERMISSIONS.HEALTH_MANAGE);
  if (permissionDenied) return { error: permissionDenied };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  await supabase
    .from("health_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("business_id", businessId);

  revalidatePath("/dashboard/health");
  revalidatePath("/dashboard/health/vaccinations");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard");
  return {};
}
