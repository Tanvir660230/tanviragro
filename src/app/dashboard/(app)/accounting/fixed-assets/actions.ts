"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { checkFinancialLock } from "@/lib/utils/financialLock";
import { todayDhaka } from "@/lib/dates";

import { getL } from "@/i18n/server-text";
export type FixedAssetFormState =
  | { success: true }
  | { error: string }
  | undefined;

export async function addFixedAsset(
  _prev: FixedAssetFormState,
  formData: FormData
): Promise<FixedAssetFormState> {
  const L = await getL();
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.ASSET_MANAGE);

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

    if (!name) return { error: L("নাম লিখুন", "Name is required") };
    if (!purchaseDate) return { error: L("কেনার তারিখ দিন", "Purchase date is required") };
    if (isNaN(purchaseCost) || purchaseCost <= 0) return { error: L("কেনা দাম ঠিক নয়", "Invalid purchase cost") };
    if (isNaN(usefulLifeYears) || usefulLifeYears <= 0) return { error: L("চলার বছর ঠিক নয়", "Invalid useful life") };
    if (decliningRate !== null && (isNaN(decliningRate) || decliningRate <= 0 || decliningRate > 1))
      return { error: L("হার ১% থেকে ১০০% এর মধ্যে হতে হবে", "Declining rate must be between 1% and 100%") };

    const lockError = await checkFinancialLock(supabase, ctx.businessId, purchaseDate);
    if (lockError) return { error: lockError };

    const { error } = await supabase.from("fixed_assets").insert({
      business_id: ctx.businessId,
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
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add fixed asset" };
  }
}

export async function disposeFixedAsset(
  id: string,
  disposalValue: number
): Promise<FixedAssetFormState> {
  const L = await getL();
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.ASSET_MANAGE);

    if (!Number.isFinite(disposalValue) || disposalValue < 0)
      return { error: L("বিক্রি মূল্য শূন্য বা তার বেশি হতে হবে", "Disposal value must be zero or positive") };

    await assertResourceOwnership(
      supabase,
      "fixed_assets",
      id,
      ctx.businessId
    );

    const { error } = await supabase
      .from("fixed_assets")
      .update({
        is_active: false,
        disposed_at: todayDhaka(),
        disposal_value: disposalValue,
      })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fixed-assets");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to dispose fixed asset" };
  }
}
