import {
  hasPermission,
  hasAllPermissions,
  requirePermission,
  requireRole,
  hasMinimumRole,
  hasRole,
} from "@/lib/auth/permissions";
import { assertResourceOwnership, assertBatchResourceOwnership } from "@/lib/auth/ownership";
import { PERMISSIONS, ROLE_PERMISSIONS, Permission } from "@/constants/roles";

import { BusinessContext } from "@/types/context";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

function createMockContext(
  role: "owner" | "admin" | "manager" | "worker" | "viewer",
  customPermissions?: Permission[]
): BusinessContext {
  const permissions = customPermissions ?? ROLE_PERMISSIONS[role] ?? [];
  return {
    businessId: "biz-123",
    business: {
      id: "biz-123",
      owner_id: "user-1",
      name: "Tanvir Agro",
      business_type: "cattle",
      created_at: "2026-01-01T00:00:00Z",
    } as any,
    membership: null,
    user: {
      id: "user-1",
      email: "tanvir@agro.com",
      profile: null,
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
}

describe("Phase 2: RBAC and Permission Engine", () => {
  test("Owner role bypasses permission checks and has all permissions", () => {
    const ownerCtx = createMockContext("owner");
    expect(hasPermission(ownerCtx, PERMISSIONS.FINANCIAL_LOCK)).toBe(true);
    expect(hasPermission(ownerCtx, PERMISSIONS.TEAM_MANAGE)).toBe(true);
    expect(hasAllPermissions(ownerCtx, [PERMISSIONS.CATTLE_VIEW, PERMISSIONS.LOAN_MANAGE])).toBe(true);
    expect(() => requirePermission(ownerCtx, PERMISSIONS.FINANCIAL_LOCK)).not.toThrow();
  });

  test("Manager role can manage cattle and inventory but cannot execute financial lock or backup", () => {
    const managerCtx = createMockContext("manager");
    expect(hasPermission(managerCtx, PERMISSIONS.CATTLE_CREATE)).toBe(true);
    expect(hasPermission(managerCtx, PERMISSIONS.INVENTORY_PURCHASE)).toBe(true);
    expect(hasPermission(managerCtx, PERMISSIONS.FINANCIAL_LOCK)).toBe(false);
    expect(hasPermission(managerCtx, PERMISSIONS.BACKUP_MANAGE)).toBe(false);

    expect(() => requirePermission(managerCtx, PERMISSIONS.CATTLE_CREATE)).not.toThrow();
    expect(() => requirePermission(managerCtx, PERMISSIONS.FINANCIAL_LOCK)).toThrow(ForbiddenError);
  });

  test("Worker role has operational permissions (weight, feed) but restricted finance access", () => {
    const workerCtx = createMockContext("worker");
    expect(hasPermission(workerCtx, PERMISSIONS.WEIGHT_LOG)).toBe(true);
    expect(hasPermission(workerCtx, PERMISSIONS.INVENTORY_CONSUME)).toBe(true);
    expect(hasPermission(workerCtx, PERMISSIONS.FEED_MIX)).toBe(true);
    expect(hasPermission(workerCtx, PERMISSIONS.FINANCE_VIEW)).toBe(false);
    expect(hasPermission(workerCtx, PERMISSIONS.COST_ENTRY_CREATE)).toBe(false);

    expect(() => requirePermission(workerCtx, PERMISSIONS.COST_ENTRY_CREATE)).toThrow(ForbiddenError);
  });

  test("Viewer role has read-only access across domain modules", () => {
    const viewerCtx = createMockContext("viewer");
    expect(hasPermission(viewerCtx, PERMISSIONS.CATTLE_VIEW)).toBe(true);
    expect(hasPermission(viewerCtx, PERMISSIONS.FINANCE_VIEW)).toBe(true);
    expect(hasPermission(viewerCtx, PERMISSIONS.CATTLE_CREATE)).toBe(false);
    expect(hasPermission(viewerCtx, PERMISSIONS.INVENTORY_PURCHASE)).toBe(false);
  });

  test("Role hierarchy and role requirement assertions", () => {
    const managerCtx = createMockContext("manager");
    expect(hasMinimumRole(managerCtx, "worker")).toBe(true);
    expect(hasMinimumRole(managerCtx, "manager")).toBe(true);
    expect(hasMinimumRole(managerCtx, "admin")).toBe(false);

    expect(hasRole(managerCtx, ["owner", "manager"])).toBe(true);
    expect(hasRole(managerCtx, ["worker"])).toBe(false);
    expect(() => requireRole(managerCtx, ["owner", "manager"])).not.toThrow();
    expect(() => requireRole(managerCtx, ["admin"])).toThrow(ForbiddenError);
  });
});

describe("Phase 2: Multi-Tenant Resource Ownership Guard", () => {
  const mockSupabase = {
    from: jest.fn().mockImplementation((table: string) => ({
      select: jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation((col: string, val: string) => ({
          maybeSingle: jest.fn().mockImplementation(async () => {
            if (val === "cattle-1") {
              return { data: { id: "cattle-1", business_id: "biz-123", tag_id: "TAG-001" }, error: null };
            }
            if (val === "cattle-other-tenant") {
              return { data: { id: "cattle-other-tenant", business_id: "other-biz-999", tag_id: "TAG-999" }, error: null };
            }
            return { data: null, error: null };
          }),
        })),
        in: jest.fn().mockImplementation((col: string, vals: string[]) => {
          const records = vals.map((v) => {
            if (v === "c1") return { id: "c1", business_id: "biz-123" };
            if (v === "c2") return { id: "c2", business_id: "biz-123" };
            if (v === "c3-other") return { id: "c3-other", business_id: "other-biz-999" };
            return null;
          }).filter(Boolean);
          return Promise.resolve({ data: records, error: null });
        }),
      })),
    })),
  } as any;

  test("Passes when resource belongs strictly to the authenticated tenant", async () => {
    const result = await assertResourceOwnership<{ id: string; business_id: string }>(
      mockSupabase,
      "cattle",
      "cattle-1",
      "biz-123"
    );
    expect(result.id).toBe("cattle-1");
    expect(result.business_id).toBe("biz-123");
  });

  test("Throws ForbiddenError when resource belongs to another tenant (BOLA protection)", async () => {
    await expect(
      assertResourceOwnership(mockSupabase, "cattle", "cattle-other-tenant", "biz-123")
    ).rejects.toThrow(ForbiddenError);
  });

  test("Throws NotFoundError when resource does not exist", async () => {
    await expect(
      assertResourceOwnership(mockSupabase, "cattle", "non-existent-id", "biz-123")
    ).rejects.toThrow(NotFoundError);
  });

  test("Batch ownership passes when all items belong to tenant and fails if any belongs to other tenant", async () => {
    await expect(
      assertBatchResourceOwnership(mockSupabase, "cattle", ["c1", "c2"], "biz-123")
    ).resolves.toBeUndefined();

    await expect(
      assertBatchResourceOwnership(mockSupabase, "cattle", ["c1", "c3-other"], "biz-123")
    ).rejects.toThrow(ForbiddenError);
  });
});

