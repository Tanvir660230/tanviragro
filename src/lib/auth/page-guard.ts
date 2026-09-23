import "server-only";
import { redirect } from "next/navigation";
import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { AuthError, NotFoundError } from "@/lib/errors";
import type { Permission } from "@/constants/roles";
import type { BusinessContext } from "@/types/context";

/** Where users land when they lack a page's permission. Every role has CATTLE_VIEW. */
export const DENIED_REDIRECT = "/dashboard/cattle?denied=1";

/**
 * Server-side permission gate for a page. Call it first in the page component
 * (not in a layout: layouts don't re-run on client navigation).
 * Roles come from the DB via getBusinessContext(), never from user_metadata.
 */
export async function requirePagePermission(permission: Permission): Promise<BusinessContext> {
  let ctx: BusinessContext;
  try {
    ctx = await getBusinessContext();
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    if (err instanceof NotFoundError) redirect("/dashboard");
    throw err;
  }
  if (!hasPermission(ctx, permission)) redirect(DENIED_REDIRECT);
  return ctx;
}
