"use server";

import { createClient } from "@/lib/supabase/server";

export async function getGlobalFormData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      success: false,
      cattle: [],
      breeds: [],
      inventoryItems: [],
      error: "Not authenticated"
    };
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!biz) {
    return {
      success: false,
      cattle: [],
      breeds: [],
      inventoryItems: [],
      error: "No business found"
    };
  }

  const [
    { data: cattleData },
    { data: inventoryData }
  ] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, tag_id, breed")
      .eq("business_id", biz.id)
      .eq("status", "active")
      .order("tag_id"),
    supabase
      .from("inventory_items")
      .select("id, name, unit, category")
      .eq("business_id", biz.id)
      .order("name")
  ]);

  const cattle = (cattleData ?? []) as { id: string; tag_id: string; breed: string | null }[];
  const existingTags = cattle.map((c) => c.tag_id);
  const existingBreeds = [...new Set(cattle.map((c) => c.breed).filter((b): b is string => Boolean(b)))].sort();

  return {
    success: true,
    cattle: cattle as { id: string, tag_id: string }[],
    existingTags: existingTags as string[],
    existingBreeds: existingBreeds as string[],
    inventoryItems: (inventoryData || []) as { id: string, name: string, unit: string, category: string }[],
  };
}
