import { getBusinessContext } from "@/lib/context/business-context";
import { hasPermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import type { Permission } from "@/constants/roles";

export const PERMISSION_DENIED_MESSAGE = "You don't have permission to perform this action.";

/**
 * Permission check for server actions that report failures as `{ error }` instead of throwing.
 * Returns an error message when the caller may not perform the action, otherwise null.
 * Role comes from the DB via getBusinessContext(); owners always pass.
 *
 * Usage (first statement of the action):
 *   const permissionDenied = await actionPermissionError(PERMISSIONS.CATTLE_DELETE);
 *   if (permissionDenied) return { error: permissionDenied };
 */
export async function actionPermissionError(permission: Permission): Promise<string | null> {
  try {
    const ctx = await getBusinessContext();
    return hasPermission(ctx, permission) ? null : PERMISSION_DENIED_MESSAGE;
  } catch (err) {
    return err instanceof AppError ? err.message : "Not authorized";
  }
}
