"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

 
async function getBusinessId(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

export async function upsertMarketPrice(
  date: string,
  pricePerKg: number,
  notes: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Valid date (YYYY-MM-DD) is required" };
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return { error: "Price must be a positive number" };

  let businessId: string;
  try {
    businessId = await getBusinessId(supabase, user.id);
  } catch (e) {
    console.error(e);
    return { error: "Business not found" };
  }

  const { error } = await supabase.from("market_prices").upsert(
    { business_id: businessId, date, price_per_kg: pricePerKg, notes: notes || null },
    { onConflict: "business_id,date" }
  );

  if (error) return { error: "Failed to save price" };
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function deleteMarketPrice(date: string): Promise<{ error?: string }> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Valid date is required" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  let businessId: string;
  try {
    businessId = await getBusinessId(supabase, user.id);
  } catch (e) {
    console.error(e);
    return { error: "Business not found" };
  }

  const { error } = await supabase
    .from("market_prices")
    .delete()
    .eq("business_id", businessId)
    .eq("date", date);

  if (error) return { error: "Failed to delete price" };
  revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
