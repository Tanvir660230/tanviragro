import {
  ENTERPRISE_NAV_CONFIG,
  canUserAccessNavItem,
  isNavActive,
  getAllNavHrefs,
  NavItemDef,
} from "@/components/navigation/nav-config";
import { SidebarExpanded } from "@/components/navigation/SidebarExpanded";
import { SidebarCollapsed } from "@/components/navigation/SidebarCollapsed";
import { MobileSidebarDrawer } from "@/components/navigation/MobileSidebarDrawer";
import { useSmartNavigation } from "@/components/navigation/use-smart-navigation";
import { AppSidebar } from "@/components/shared/AppSidebar";
import { AppSidebarWrapper } from "@/components/shared/AppSidebarWrapper";

describe("Smart Navigation Configuration & Access Control (Sprint 03)", () => {
  test("defines all required enterprise groups with complete metadata", () => {
    expect(ENTERPRISE_NAV_CONFIG.length).toBeGreaterThanOrEqual(5);

    const groupIds = ENTERPRISE_NAV_CONFIG.map((g) => g.id);
    expect(groupIds).toContain("core");
    expect(groupIds).toContain("operations");
    expect(groupIds).toContain("commerce");
    expect(groupIds).toContain("finance");
    expect(groupIds).toContain("administration");

    // Check that every group has non-empty items with icons and valid hrefs
    for (const group of ENTERPRISE_NAV_CONFIG) {
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(item.id).toBeTruthy();
        expect(item.defaultLabel).toBeTruthy();
        expect(item.href).toMatch(/^\/dashboard/);
        expect(item.icon).toBeDefined();

        if (item.children) {
          for (const child of item.children) {
            expect(child.id).toBeTruthy();
            expect(child.defaultLabel).toBeTruthy();
            expect(child.href).toMatch(/^\/dashboard/);
          }
        }
      }
    }
  });

  test("collects all distinct navigation hrefs accurately", () => {
    const hrefs = getAllNavHrefs(ENTERPRISE_NAV_CONFIG);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/dashboard/cattle");
    expect(hrefs).toContain("/dashboard/health");
    expect(hrefs).toContain("/dashboard/inventory");
    expect(hrefs).toContain("/dashboard/finance");
    expect(hrefs).toContain("/dashboard/accounting");
    expect(hrefs).toContain("/dashboard/partners");
    expect(hrefs).toContain("/dashboard/vendors");
    expect(hrefs).toContain("/dashboard/settings");
  });

  test("evaluates role-based access control accurately", () => {
    const adminOnlyItem: NavItemDef = {
      id: "test-admin",
      labelKey: "settings",
      defaultLabel: "Settings",
      href: "/dashboard/settings",
      icon: () => null,
      adminOnly: true,
      requiredRoles: ["owner", "admin"],
    };

    const workerItem: NavItemDef = {
      id: "test-cattle",
      labelKey: "cattle",
      defaultLabel: "Cattle",
      href: "/dashboard/cattle",
      icon: () => null,
    };

    // Unrestricted cattle item
    expect(canUserAccessNavItem(workerItem, "worker", false)).toBe(true);
    expect(canUserAccessNavItem(workerItem, "owner", false)).toBe(true);

    // Restricted settings item
    expect(canUserAccessNavItem(adminOnlyItem, "owner", false)).toBe(true);
    expect(canUserAccessNavItem(adminOnlyItem, "admin", false)).toBe(true);
    expect(canUserAccessNavItem(adminOnlyItem, "manager", false)).toBe(false);
    expect(canUserAccessNavItem(adminOnlyItem, "worker", false)).toBe(false);

    // Admin bypass flag
    expect(canUserAccessNavItem(adminOnlyItem, "worker", true)).toBe(true);
  });

  test("calculates active and child routing matches", () => {
    const allHrefs = [
      "/dashboard",
      "/dashboard/cattle",
      "/dashboard/cattle/health",
      "/dashboard/inventory",
      "/dashboard/finance",
    ];

    // Exact matches
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard/cattle", "/dashboard/cattle")).toBe(true);

    // Dashboard root should not match subpages
    expect(isNavActive("/dashboard", "/dashboard/cattle")).toBe(false);

    // Subpath match when more specific item doesn't exist
    expect(isNavActive("/dashboard/cattle", "/dashboard/cattle/123/edit")).toBe(true);

    // Subpath match behavior with startsWith
    expect(isNavActive("/dashboard/cattle", "/dashboard/cattle/health")).toBe(true);
    expect(isNavActive("/dashboard/cattle/health", "/dashboard/cattle/health")).toBe(true);

    // Unrelated route
    expect(isNavActive("/dashboard/finance", "/dashboard/cattle")).toBe(false);
  });

  test("exports all required sidebar components and hook definitions", () => {
    expect(typeof SidebarExpanded).toBe("function");
    expect(typeof SidebarCollapsed).toBe("function");
    expect(typeof MobileSidebarDrawer).toBe("function");
    expect(typeof AppSidebar).toBe("function");
    expect(typeof AppSidebarWrapper).toBe("function");
    expect(typeof useSmartNavigation).toBe("function");
  });
});



