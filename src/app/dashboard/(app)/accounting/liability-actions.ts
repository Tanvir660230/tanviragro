"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/lib/context/business-context";
import { requirePermission } from "@/lib/auth/permissions";
import { assertResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS } from "@/constants/roles";
import { verifyFinancialLock } from "@/lib/financial/financial-lock";

function revalidate() {
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/balance-sheet");
  revalidateTag("accounting", { expire: 0 });
}

export async function addLiability(input: {
  name: string;
  category: string;
  principal: number;
  outstanding: number;
  lender: string | null;
  due_date: string | null;
}): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.LOAN_MANAGE);

    if (!input.name?.trim()) return { error: "Name is required" };
    if (!Number.isFinite(input.principal) || input.principal <= 0)
      return { error: "Principal must be a positive number" };
    if (!Number.isFinite(input.outstanding) || input.outstanding < 0)
      return { error: "Outstanding balance must be zero or positive" };

    const today = new Date().toISOString().slice(0, 10);
    const lockError = await verifyFinancialLock(supabase, ctx.businessId, today);
    if (lockError) return { error: lockError };

    const { error } = await supabase.from("liabilities").insert({
      business_id: ctx.businessId,
      name: input.name,
      category: input.category,
      principal: input.principal,
      outstanding: input.outstanding,
      lender: input.lender,
      due_date: input.due_date,
    });

    if (error) return { error: "Failed to add liability" };
    revalidate();
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to add liability" };
  }
}

export async function updateOutstanding(id: string, outstanding: number): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.LOAN_MANAGE);

    if (!Number.isFinite(outstanding) || outstanding < 0)
      return { error: "Outstanding balance must be zero or positive" };

    await assertResourceOwnership(supabase, "liabilities", id, ctx.businessId);

    const today = new Date().toISOString().slice(0, 10);
    const lockError = await verifyFinancialLock(supabase, ctx.businessId, today);
    if (lockError) return { error: lockError };

    const { error } = await supabase
      .from("liabilities")
      .update({ outstanding })
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) return { error: "Failed to update" };
    revalidate();
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update liability" };
  }
}

export async function settleLiability(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.LOAN_MANAGE);

    await assertResourceOwnership(supabase, "liabilities", id, ctx.businessId);

    const today = new Date().toISOString().slice(0, 10);
    const lockError = await verifyFinancialLock(supabase, ctx.businessId, today);
    if (lockError) return { error: lockError };

    const { error } = await supabase
      .from("liabilities")
      .update({ outstanding: 0, settled_at: today })
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) return { error: "Failed to settle" };
    revalidate();
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to settle liability" };
  }
}

export async function deleteLiability(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const ctx = await getBusinessContext(supabase);
    requirePermission(ctx, PERMISSIONS.LOAN_MANAGE);

    await assertResourceOwnership(supabase, "liabilities", id, ctx.businessId);

    const { error } = await supabase
      .from("liabilities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) return { error: "Failed to delete" };
    revalidate();
    return {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete liability" };
  }
}