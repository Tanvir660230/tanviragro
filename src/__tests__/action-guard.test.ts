import { PERMISSIONS, ROLE_PERMISSIONS, type ExtendedUserRole } from "@/constants/roles";
import { AuthError } from "@/lib/errors";

const mockGetBusinessContext = jest.fn();
jest.mock("@/lib/context/business-context", () => ({
  getBusinessContext: () => mockGetBusinessContext(),
}));

import { actionPermissionError, PERMISSION_DENIED_MESSAGE } from "@/lib/auth/action-guard";

function ctxFor(role: ExtendedUserRole) {
  return {
    businessId: "biz-1",
    role,
    permissions: ROLE_PERMISSIONS[role],
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
  };
}

describe("actionPermissionError", () => {
  afterEach(() => mockGetBusinessContext.mockReset());

  test("owner may do anything", async () => {
    mockGetBusinessContext.mockResolvedValue(ctxFor("owner"));
    await expect(actionPermissionError(PERMISSIONS.CATTLE_DELETE)).resolves.toBeNull();
    await expect(actionPermissionError(PERMISSIONS.SETTINGS_EDIT)).resolves.toBeNull();
  });

  test("worker cannot delete cattle, purge trash, or edit purchase data", async () => {
    mockGetBusinessContext.mockResolvedValue(ctxFor("worker"));
    await expect(actionPermissionError(PERMISSIONS.CATTLE_DELETE)).resolves.toBe(PERMISSION_DENIED_MESSAGE);
    await expect(actionPermissionError(PERMISSIONS.SETTINGS_EDIT)).resolves.toBe(PERMISSION_DENIED_MESSAGE);
    await expect(actionPermissionError(PERMISSIONS.CATTLE_EDIT)).resolves.toBe(PERMISSION_DENIED_MESSAGE);
    await expect(actionPermissionError(PERMISSIONS.FINANCE_VIEW)).resolves.toBe(PERMISSION_DENIED_MESSAGE);
  });

  test("worker keeps daily field permissions", async () => {
    mockGetBusinessContext.mockResolvedValue(ctxFor("worker"));
    await expect(actionPermissionError(PERMISSIONS.WEIGHT_LOG)).resolves.toBeNull();
    await expect(actionPermissionError(PERMISSIONS.INVENTORY_CONSUME)).resolves.toBeNull();
    await expect(actionPermissionError(PERMISSIONS.FEED_MIX)).resolves.toBeNull();
  });

  test("manager can edit cattle but not purge trash", async () => {
    mockGetBusinessContext.mockResolvedValue(ctxFor("manager"));
    await expect(actionPermissionError(PERMISSIONS.CATTLE_EDIT)).resolves.toBeNull();
    await expect(actionPermissionError(PERMISSIONS.SETTINGS_EDIT)).resolves.toBe(PERMISSION_DENIED_MESSAGE);
  });

  test("unauthenticated caller is rejected with the auth error message", async () => {
    mockGetBusinessContext.mockRejectedValue(new AuthError("Authentication required"));
    await expect(actionPermissionError(PERMISSIONS.CATTLE_VIEW)).resolves.toBe("Authentication required");
  });

  test("unexpected failures are rejected generically", async () => {
    mockGetBusinessContext.mockRejectedValue(new Error("db down: secret detail"));
    await expect(actionPermissionError(PERMISSIONS.CATTLE_VIEW)).resolves.toBe("Not authorized");
  });
});
