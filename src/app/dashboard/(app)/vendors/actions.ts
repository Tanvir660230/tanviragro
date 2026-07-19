"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VendorType } from "@/types/database";

export type VendorFormState = { error?: string; success?: boolean } | undefined;

type TypedClient = Awaited<ReturnType<typeof createClient>>;

import { getCurrentBusinessId } from "@/lib/supabase/get-business";

export async function createVendor(
  _prev: VendorFormState,
  formData: FormData
): Promise<VendorFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as VendorType;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!name) return { error: "ভেন্ডরের নাম দিন" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) {
    return { error: "Business not found or access denied" };
  }

  const { error } = await (supabase).from("vendors").insert({
    business_id: businessId,
    name,
    type: type || "other",
    phone,
    address,
    notes,
  });

  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে" };

  revalidatePath("/dashboard/vendors");
  return { success: true };
}

export async function deleteVendor(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) {
    return { error: "Business not found" };
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!vendor || vendor.business_id !== businessId) return { error: "Unauthorized" };

  // Explicitly check linked records — FK is ON DELETE SET NULL (silent delete),
  // so we guard it here to warn the user instead of silently orphaning their data.
  const [{ count: cattleCount }, { count: itemCount }] = await Promise.all([
    supabase.from("cattle").select("id", { count: "exact", head: true }).eq("vendor_id", id),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("vendor_id", id).is("deleted_at", null),
  ]);
  if ((cattleCount ?? 0) + (itemCount ?? 0) > 0) {
    return { error: `Cannot delete vendor — linked to ${cattleCount ?? 0} cattle and ${itemCount ?? 0} inventory items. Remove the link from each record first.` };
  }

  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) return { error: "Failed to delete vendor" };

  revalidatePath("/dashboard/vendors");
  return {};
}
