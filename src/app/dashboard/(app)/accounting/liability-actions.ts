"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { checkFinancialLock } from "@/lib/utils/financialLock";

type TypedClient = Awaited<ReturnType<typeof createClient>>;



/** Verify the liability belongs to this user's business before mutating. */
async function assertOwnership(supabase: TypedClient, liabilityId: string, businessId: string): Promise<boolean> {
  const { data } = await supabase
    .from("liabilities")
    .select("id")
    .eq("id", liabilityId)
    .eq("business_id", businessId)
    .maybeSingle();
  return !!data;
}

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!input.name?.trim()) return { error: "Name is required" };
  if (!Number.isFinite(input.principal) || input.principal <= 0)
    return { error: "Principal must be a positive number" };
  if (!Number.isFinite(input.outstanding) || input.outstanding < 0)
    return { error: "Outstanding balance must be zero or positive" };

  const today = new Date().toISOString().slice(0, 10);
  const lockError = await checkFinancialLock(supabase, businessId, today);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("liabilities").insert({
    business_id: businessId,
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
}

export async function updateOutstanding(id: string, outstanding: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!Number.isFinite(outstanding) || outstanding < 0)
    return { error: "Outstanding balance must be zero or positive" };
  if (!(await assertOwnership(supabase, id, businessId))) return { error: "Not found" };

  const today = new Date().toISOString().slice(0, 10);
  const lockError = await checkFinancialLock(supabase, businessId, today);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("liabilities").update({ outstanding }).eq("id", id).eq("business_id", businessId);
  if (error) return { error: "Failed to update" };
  revalidate();
  return {};
}

export async function settleLiability(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!(await assertOwnership(supabase, id, businessId))) return { error: "Not found" };

  const today = new Date().toISOString().slice(0, 10);
  const lockError = await checkFinancialLock(supabase, businessId, today);
  if (lockError) return { error: lockError };

  const { error } = await supabase.from("liabilities")
    .update({ outstanding: 0, settled_at: today })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) return { error: "Failed to settle" };
  revalidate();
  return {};
}

export async function deleteLiability(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  if (!(await assertOwnership(supabase, id, businessId))) return { error: "Not found" };

  // Soft-delete: preserve balance sheet history
  const today = new Date().toISOString().slice(0, 10);
  const lockError = await checkFinancialLock(supabase, businessId, today);
  if (lockError) return { error: lockError };

  const { error } = await supabase
    .from("liabilities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) return { error: "Failed to delete" };
  revalidate();
  return {};
}
