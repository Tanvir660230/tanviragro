import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessContext } from "@/lib/context/business-context";

export async function getCurrentBusinessId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const ctx = await getBusinessContext(supabase);
    return ctx.businessId;
  } catch {
    return null;
  }
}

export async function getCurrentBusiness(
  supabase: SupabaseClient
): Promise<{ id: string; name: string; fiscal_year_start_month: number } | null> {
  try {
    const ctx = await getBusinessContext(supabase);
    return {
      id: ctx.business.id,
      name: ctx.business.name ?? "Farm",
      fiscal_year_start_month: ctx.business.fiscal_year_start_month ?? 7,
    };
  } catch {
    return null;
  }
}
