"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";

export async function completeHealthEventHub(eventId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { error } = await supabase
    .from("health_events")
    .update({ completed_at: new Date().toISOString().slice(0, 10) })
    .eq("id", eventId)
    .eq("business_id", businessId);

  if (error) return { error: "Failed to update" };

  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteHealthEventHub(eventId: string): Promise<{ error?: string }> {
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

  revalidatePath("/dashboard/cattle/health");
  revalidatePath("/dashboard");
  return {};
}
