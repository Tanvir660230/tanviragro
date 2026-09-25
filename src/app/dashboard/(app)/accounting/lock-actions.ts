"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";

import { getL } from "@/i18n/server-text";
export type LockFormState = { error?: string; success?: boolean } | undefined;

export async function createFinancialLock(
  _prev: LockFormState,
  formData: FormData
): Promise<LockFormState> {
  const L = await getL();
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.FINANCIAL_LOCK);

    const locked_until = formData.get("locked_until") as string;
    if (!locked_until) return { error: L("তারিখ দিন", "Date is required") };

    const { error } = await supabase
      .from("financial_locks")
      .insert({ business_id: ctx.businessId, locked_until, created_by: ctx.user.id });

    if (error) return { error: L("লক করা যায়নি", "Failed to create lock") };

    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : L("লক করা যায়নি", "Failed to create lock") };
  }
}

export async function deleteFinancialLock(lockId: string): Promise<{ error?: string }> {
  const L = await getL();
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.FINANCIAL_LOCK);

    await assertResourceOwnership(
      supabase,
      "financial_locks",
      lockId,
      ctx.businessId
    );

    const { error } = await supabase.from("financial_locks").delete().eq("id", lockId);
    if (error) return { error: L("লক সরানো যায়নি", "Failed to delete lock") };

    revalidatePath("/dashboard/accounting");
    revalidateTag("accounting", { expire: 0 });
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : L("লক সরানো যায়নি", "Failed to delete lock") };
  }
}
