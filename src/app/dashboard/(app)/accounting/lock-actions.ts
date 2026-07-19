"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LockFormState = { error?: string; success?: boolean } | undefined;

export async function createFinancialLock(
  _prev: LockFormState,
  formData: FormData
): Promise<LockFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const locked_until = formData.get("locked_until") as string;
  if (!locked_until) return { error: "Date is required" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { error } = await supabase
    .from("financial_locks")
    .insert({ business_id: biz.id, locked_until, created_by: user.id });

  if (error) return { error: "Failed to create lock" };

  revalidatePath("/dashboard/accounting");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function deleteFinancialLock(lockId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: biz } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!biz) return { error: "Business not found" };

  const { data: lock } = await supabase
    .from("financial_locks")
    .select("business_id")
    .eq("id", lockId)
    .maybeSingle();
  if (!lock || lock.business_id !== biz.id) return { error: "Unauthorized" };

  const { error } = await supabase.from("financial_locks").delete().eq("id", lockId);
  if (error) return { error: "Failed to delete lock" };

  revalidatePath("/dashboard/accounting");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
