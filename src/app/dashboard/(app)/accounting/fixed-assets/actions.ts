"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type FixedAssetFormState =
  | { success: true }
  | { error: string }
  | undefined;

export async function addFixedAsset(
  _prev: FixedAssetFormState,
  formData: FormData
): Promise<FixedAssetFormState> {
   
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "No business found" };

  const name = ((formData.get("name") as string | null) ?? "").trim();
  const category = (formData.get("category") as string | null ?? "infrastructure") as "infrastructure" | "equipment" | "vehicle" | "other";
  const description = ((formData.get("description") as string | null) ?? "").trim() || null;
  const purchaseDate = formData.get("purchase_date") as string;
  const purchaseCost = parseFloat(formData.get("purchase_cost") as string);
  const salvageValue = parseFloat(formData.get("salvage_value") as string) || 0;
  const usefulLifeYears = parseFloat(formData.get("useful_life_years") as string);
  const depreciationMethod = (formData.get("depreciation_method") as string) as "straight_line" | "declining_balance";
  const decliningRateRaw = formData.get("declining_rate") as string;
  const decliningRate = depreciationMethod === "declining_balance" && decliningRateRaw
    ? parseFloat(decliningRateRaw) / 100
    : null;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;

  if (!name) return { error: "Name is required" };
  if (!purchaseDate) return { error: "Purchase date is required" };
  if (isNaN(purchaseCost) || purchaseCost <= 0) return { error: "Invalid purchase cost" };
  if (isNaN(usefulLifeYears) || usefulLifeYears <= 0) return { error: "Invalid useful life" };
  if (decliningRate !== null && (isNaN(decliningRate) || decliningRate <= 0 || decliningRate > 1))
    return { error: "Declining rate must be between 1% and 100%" };

  const lockError = await checkFinancialLock(supabase, biz.id, purchaseDate);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("fixed_assets").insert({
    business_id: biz.id,
    name,
    category,
    description,
    purchase_date: purchaseDate,
    purchase_cost: purchaseCost,
    salvage_value: salvageValue,
    useful_life_years: usefulLifeYears,
    depreciation_method: depreciationMethod,
    declining_rate: decliningRate,
    notes,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fixed-assets");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function disposeFixedAsset(
  id: string,
  disposalValue: number
): Promise<FixedAssetFormState> {

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  if (!Number.isFinite(disposalValue) || disposalValue < 0)
    return { error: "Disposal value must be zero or positive" };

  const { data: asset } = await supabase
    .from("fixed_assets")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();
  if (!asset || asset.business_id !== biz.id) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("fixed_assets")
    .update({
      is_active: false,
      disposed_at: new Date().toISOString().split("T")[0],
      disposal_value: disposalValue,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fixed-assets");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}
