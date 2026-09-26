import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Business, Profile, BusinessUser } from "@/types/database";
import type { BusinessContext } from "@/types/context";
import { ROLE_PERMISSIONS, ExtendedUserRole, Permission } from "@/constants/roles";
import { AuthError, NotFoundError } from "@/lib/errors";

type RoleRPCResult = { business_id?: string; role?: string } | null;

/** One Supabase client per request for the context (the user's own client, row-level security). */
const requestClient = cache(async () => createClient());

/**
 * The signed-in user, from the session's JWT verified locally (the project signs with ES256, so
 * getClaims checks the signature against the public key — no call to the auth server). It used
 * to be auth.getUser(), a network round trip, made 8–10 times per page.
 */
export const getAuthUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await requestClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? "" };
});

/**
 * Request-memoized, authoritative resolution of tenant context, RBAC roles, permissions and
 * business settings — once per request, whichever client the caller holds (it used to be cached
 * per client object, so each part of a page that made its own client resolved it again).
 */
const resolveContext = cache(async (): Promise<BusinessContext> => {
  const user = await getAuthUser();
  if (!user) throw new AuthError("Authentication required to access business context");
  const supabase = await requestClient();

  // the owner's business and the profile at the same time (one round trip, not two)
  const [{ data: ownerBiz }, { data: profileData }] = await Promise.all([
    supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle(),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  let business: Business | null = ownerBiz as Business | null;
  let role: ExtendedUserRole = "owner";
  let membership: BusinessUser | null = null;

  // a team member: their membership, then the business
  if (!business) {
    const { data: teamMembership } = await supabase.from("business_users").select("*").eq("user_id", user.id).maybeSingle();
    if (teamMembership?.business_id) {
      membership = teamMembership as BusinessUser;
      role = (teamMembership.role as ExtendedUserRole) || "worker";
      const { data: memberBiz } = await supabase.from("businesses").select("*").eq("id", teamMembership.business_id).maybeSingle();
      business = memberBiz as Business | null;
    }
  }

  // fallback: the get_user_business_role RPC if the direct reads missed
  if (!business) {
    const { data: rpcData } = await supabase.rpc("get_user_business_role", { p_user_id: user.id });
    const parsedRpc = rpcData as RoleRPCResult;
    if (parsedRpc?.business_id) {
      role = (parsedRpc.role as ExtendedUserRole) || "worker";
      const { data: rpcBiz } = await supabase.from("businesses").select("*").eq("id", parsedRpc.business_id).maybeSingle();
      business = rpcBiz as Business | null;
    }
  }

  if (!business) throw new NotFoundError("Active business not found for user", user.id);

  const permissions: readonly Permission[] = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.worker;

  return {
    businessId: business.id,
    business,
    membership,
    user: { id: user.id, email: user.email, profile: (profileData as Profile) || null },
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

/** The client argument is accepted for old callers; the context is the same for the whole request. */
export const getBusinessContext = (_supabase?: SupabaseClient): Promise<BusinessContext> => resolveContext();
