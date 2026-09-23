import { BusinessContext } from "@/types/context";
import { Permission, ExtendedUserRole, ROLE_HIERARCHY } from "@/constants/roles";
import { ForbiddenError } from "@/lib/errors";

/**
 * Checks if the given context has the requested permission.
 */
export function hasPermission(
  context: BusinessContext,
  permission: Permission
): boolean {
  if (context.isOwner) return true;
  return context.permissions.includes(permission);
}

/**
 * Checks if context satisfies all requested permissions.
 */
export function hasAllPermissions(
  context: BusinessContext,
  permissions: Permission[]
): boolean {
  if (context.isOwner) return true;
  return permissions.every((p) => context.permissions.includes(p));
}

/**
 * Checks if context satisfies at least one of the requested permissions.
 */
export function hasAnyPermission(
  context: BusinessContext,
  permissions: Permission[]
): boolean {
  if (context.isOwner) return true;
  return permissions.some((p) => context.permissions.includes(p));
}

/**
 * Enforces permission requirement, throwing ForbiddenError if not satisfied.
 */
export function requirePermission(
  context: BusinessContext,
  permission: Permission
): void {
  if (!hasPermission(context, permission)) {
    throw new ForbiddenError(
      `Access denied: Missing required permission [${permission}] for role [${context.role}]`
    );
  }
}

/**
 * Enforces all permissions requirement.
 */
export function requireAllPermissions(
  context: BusinessContext,
  permissions: Permission[]
): void {
  for (const perm of permissions) {
    requirePermission(context, perm);
  }
}

/**
 * Enforces that user has at least one of the required permissions.
 */
export function requireAnyPermission(
  context: BusinessContext,
  permissions: Permission[]
): void {
  if (!hasAnyPermission(context, permissions)) {
    throw new ForbiddenError(
      `Access denied: User requires at least one of [${permissions.join(", ")}]`
    );
  }
}

/**
 * Checks if user has a role with at least the rank of the specified minimum role.
 */
export function hasMinimumRole(
  context: BusinessContext,
  minRole: ExtendedUserRole
): boolean {
  const userRank = ROLE_HIERARCHY[context.role] ?? 0;
  const targetRank = ROLE_HIERARCHY[minRole] ?? 0;
  return userRank >= targetRank;
}

/**
 * Checks if user has one of the specific matching roles.
 */
export function hasRole(
  context: BusinessContext,
  roles: ExtendedUserRole | ExtendedUserRole[]
): boolean {
  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.includes(context.role);
}

/**
 * Enforces that user has one of the allowed roles.
 */
export function requireRole(
  context: BusinessContext,
  roles: ExtendedUserRole | ExtendedUserRole[]
): void {
  if (!hasRole(context, roles)) {
    const list = Array.isArray(roles) ? roles.join(", ") : roles;
    throw new ForbiddenError(
      `Access denied: Action requires role [${list}], current role is [${context.role}]`
    );
  }
}