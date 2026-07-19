import type { SupabaseClient } from "@supabase/supabase-js";

type RoleRPCResult = { business_id?: string; role?: string } | null;

/** Resolves the business_id for owners AND team members (manager/worker). */
async function resolveBusinessId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  // Fast path: owner query (single index lookup, most users hit this)
  const { data: ownerRow } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownerRow?.id) return ownerRow.id;

  // Fallback: team member lookup via the shared RPC
  const { data: roleData } = await supabase.rpc("get_user_business_role", { p_user_id: userId });
  return (roleData as RoleRPCResult)?.business_id ?? null;
}

export async function getCurrentBusinessId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return resolveBusinessId(supabase, user.id);
}

export async function getCurrentBusiness(
  supabase: SupabaseClient
): Promise<{ id: string; name: string; fiscal_year_start_month: number } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const businessId = await resolveBusinessId(supabase, user.id);
  if (!businessId) return null;

  const { data } = await supabase
    .from("businesses")
    .select("id, name, fiscal_year_start_month")
    .eq("id", businessId)
    .maybeSingle();

  if (!data?.id) return null;
  const d = data as { id: string; name?: string; fiscal_year_start_month?: number };
  return { id: d.id, name: d.name ?? "Farm", fiscal_year_start_month: d.fiscal_year_start_month ?? 7 };
}
