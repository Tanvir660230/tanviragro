"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedBusinessId } from "@/lib/supabase/cached";
import { revalidatePath } from "next/cache";
import { PenType } from "@/lib/livestock/pen-engine";

export async function createFarmAction(formData: FormData) {
  const businessId = await getCachedBusinessId();
  if (!businessId) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const location = formData.get("location") as string;
  const capacity = Number(formData.get("capacity") || 500);

  const supabase = await createClient();
  const { error } = await supabase.from("farms").insert({
    business_id: businessId,
    name,
    code: code.toUpperCase(),
    location: location || null,
    capacity,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cattle/pens");
  return { success: true };
}

export async function createPenAction(formData: FormData) {
  const businessId = await getCachedBusinessId();
  if (!businessId) throw new Error("Unauthorized");

  const farmId = formData.get("farmId") as string;
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const type = (formData.get("type") || "fattening") as PenType;
  const capacity = Number(formData.get("capacity") || 20);

  const supabase = await createClient();
  const { error } = await supabase.from("pens").insert({
    business_id: businessId,
    farm_id: farmId,
    name,
    code: code.toUpperCase(),
    type,
    capacity,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cattle/pens");
  return { success: true };
}

export async function transferCattlePenAction(cattleId: string, targetPenId: string | null, farmId?: string | null) {
  const businessId = await getCachedBusinessId();
  if (!businessId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const updateData: { pen_id: string | null; farm_id?: string | null } = { pen_id: targetPenId };
  if (farmId) updateData.farm_id = farmId;

  const { error } = await supabase
    .from("cattle")
    .update(updateData)
    .eq("id", cattleId)
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cattle");
  revalidatePath("/dashboard/cattle/pens");
  return { success: true };
}

