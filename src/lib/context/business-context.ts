import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Business, Profile, BusinessUser } from "@/types/database";
import type { BusinessContext } from "@/types/context";
import { ROLE_PERMISSIONS, ExtendedUserRole, Permission } from "@/constants/roles";
import { AuthError, NotFoundError } from "@/lib/errors";

type RoleRPCResult = { business_id?: string; role?: string } | null;

/**
 * Request-memoized, authoritative resolution of tenant context, RBAC roles,
 * permissions, and business settings.
 */
export const getBusinessContext = cache(async (
  providedSupabase?: SupabaseClient
): Promise<BusinessContext> => {
  const supabase = providedSupabase || (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.id) {
    throw new AuthError("Authentication required to access business context");
  }

  // 1. Primary path: check if user is an owner
  const { data: ownerBiz } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  let business: Business | null = ownerBiz as Business | null;
  let role: ExtendedUserRole = "owner";
  let membership: BusinessUser | null = null;

  // 2. Secondary path: check team membership in business_users table
  if (!business) {
    const { data: teamMembership } = await supabase
      .from("business_users")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (teamMembership?.business_id) {
      membership = teamMembership as BusinessUser;
      role = (teamMembership.role as ExtendedUserRole) || "worker";
      const { data: memberBiz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", teamMembership.business_id)
        .maybeSingle();
      business = memberBiz as Business | null;
    }
  }

  // 3. Fallback: via get_user_business_role RPC if direct join was missed
  if (!business) {
    const { data: rpcData } = await supabase.rpc("get_user_business_role", { p_user_id: user.id });
    const parsedRpc = rpcData as RoleRPCResult;
    if (parsedRpc?.business_id) {
      role = (parsedRpc.role as ExtendedUserRole) || "worker";
      const { data: rpcBiz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", parsedRpc.business_id)
        .maybeSingle();
      business = rpcBiz as Business | null;
    }
  }

  if (!business) {
    throw new NotFoundError("Active business not found for user", user.id);
  }

  // 4. Resolve user profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const permissions: readonly Permission[] = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.worker;

  return {
    businessId: business.id,
    business,
    membership,
    user: {
      id: user.id,
      email: user.email ?? "",
      profile: (profileData as Profile) || null,
    },
    role,
    permissions,
    locale: "bn-BD",
    currency: "BDT",
    timezone: "Asia/Dhaka",
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    isManager: role === "owner" || role === "admin" || role === "manager",
    canManageFinance: role === "owner" || role === "admin",
  };
});
