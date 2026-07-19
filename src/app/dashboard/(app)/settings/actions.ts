"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsFormState =
  | { error?: string; success?: string }
  | undefined;

export async function updateBusinessName(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("business_name") as string)?.trim();
  if (!name) return { error: "Business name cannot be empty" };

  const { error } = await supabase
    .from("businesses")
    .update({ name })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to update business name" };

  revalidatePath("/dashboard/settings");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Business name updated" };
}

export async function updateBusinessProfile(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("business_name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const logoFile = formData.get("logo") as File | null;

  if (!name) return { error: "Business name cannot be empty" };

  let logoUrl = undefined;

  // Handle logo upload
  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, logoFile, { upsert: true });

    if (uploadError) {
      return { error: "Failed to upload logo: " + uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);
      
    logoUrl = publicUrlData.publicUrl;
  }

  const updates: { name: string; address?: string; phone?: string; email?: string; logo_url?: string } = { name, address, phone, email };
  if (logoUrl) updates.logo_url = logoUrl;

  const { error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to update business profile: " + error.message };

  revalidatePath("/", "layout");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Business profile updated successfully" };
}

export async function updateProfile(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const fullName = (formData.get("full_name") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const avatarFile = formData.get("avatar") as File | null;

  let avatarUrl = undefined;

  // Handle avatar upload
  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true });

    if (uploadError) {
      return { error: "Failed to upload avatar: " + uploadError.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
      
    avatarUrl = publicUrlData.publicUrl;
  }

  const updates: { id: string; full_name?: string; title?: string; phone?: string; updated_at: string; avatar_url?: string } = { id: user.id, full_name: fullName, title, phone, updated_at: new Date().toISOString() };
  if (avatarUrl) updates.avatar_url = avatarUrl;

  // upsert handles both first-time creation and subsequent updates
  const { error } = await supabase
    .from("profiles")
    .upsert(updates, { onConflict: "id" });

  if (error) return { error: "Failed to update profile: " + error.message };

  revalidatePath("/", "layout");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Profile updated successfully" };
}

export async function updatePassword(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 8)
    return { error: "Password must be at least 8 characters" };
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: "Password updated successfully" };
}

export async function saveOpeningCash(
  amount: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { error } = await supabase
    .from("businesses").update({ opening_cash_balance: amount }).eq("id", biz.id);
  if (error) return { error: "Failed to save" };

  revalidatePath("/dashboard");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/accounting");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function saveManagementFeeRate(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!biz) return { error: "Business not found" };

  const rate = parseFloat(formData.get("rate_percent") as string);
  const effectiveFrom = (formData.get("effective_from") as string)?.trim();

  if (isNaN(rate) || rate < 0 || rate > 100) return { error: "Rate must be between 0 and 100" };
  if (!effectiveFrom) return { error: "Effective date is required" };

  const { error } = await supabase
    .from("management_fee_rates")
    .insert({ business_id: biz.id, rate_percent: rate, effective_from: effectiveFrom });

  if (error) return { error: "Failed to save: " + (error as { message: string }).message };

  revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Management fee rate updated" };
}

export async function deleteManagementFeeRate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Ownership check — only allow deleting rates belonging to this user's business
  const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { data: rate } = await supabase.from("management_fee_rates").select("business_id").eq("id", id).maybeSingle();
  if (!rate || rate.business_id !== biz.id) return { error: "Not authorized" };

  // Soft-delete: preserves fee rate history so historical profit shares remain correct
  const { error } = await supabase
    .from("management_fee_rates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Failed to delete" };
  revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return {};
}

export async function saveUnitPrice(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const price = parseInt(formData.get("unit_price_bdt") as string, 10);
  if (isNaN(price) || price < 100) return { error: "Unit price must be at least ৳100" };

  const { error } = await supabase
    .from("businesses")
    .update({ unit_price_bdt: price })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to save unit price" };
  revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Unit price updated" };
}

export async function saveDailyGain(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const gain = parseFloat(formData.get("default_daily_gain_kg") as string);
  if (isNaN(gain) || gain <= 0 || gain > 5) return { error: "Daily gain must be between 0.1 and 5 kg" };

  const { error } = await supabase
    .from("businesses")
    .update({ default_daily_gain_kg: gain })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to save daily gain" };
  revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/partners");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Daily weight gain updated" };
}

export async function updateTaxSettings(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const taxRate = parseFloat(formData.get("tax_rate") as string);
  if (isNaN(taxRate) || taxRate < 0 || taxRate > 100)
    return { error: "Tax rate must be between 0 and 100" };

  const { error } = await supabase
    .from("businesses")
    .update({ default_tax_rate: taxRate })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to save tax settings" };

  revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/accounting");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Tax settings updated" };
}

export async function updateFiscalYear(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const month = parseInt(formData.get("fiscal_year_start_month") as string, 10);
  if (isNaN(month) || month < 1 || month > 12)
    return { error: "Select a valid month (1–12)" };

  const { error } = await supabase
    .from("businesses")
    .update({ fiscal_year_start_month: month })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to save fiscal year setting" };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/accounting");
  revalidateTag("accounting", { expire: 0 });
  return { success: "Fiscal year updated" };
}

export async function updateDefaultRoughage(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const allowed = ["straw", "hay", "silage", "grass"] as const;
  const roughage = formData.get("default_roughage_type") as string;
  if (!allowed.includes(roughage as (typeof allowed)[number]))
    return { error: "Invalid roughage type" };

  const { error } = await supabase
    .from("businesses")
    .update({ default_roughage_type: roughage as "straw" | "hay" | "silage" | "grass" })
    .eq("owner_id", user.id);

  if (error) return { error: "Failed to save roughage setting" };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/cattle");
  return { success: "Default roughage updated" };
}
