import { MASTER_WIDGET_CATALOG, ROLE_DEFAULT_WIDGETS } from "@/components/dashboard/engine/default-widgets";
import type { DashboardRole } from "@/components/dashboard/engine/widget-types";

describe("Enterprise Dashboard Engine & Personalization System", () => {
  it("should define all essential executive widgets in the master catalog", () => {
    expect(MASTER_WIDGET_CATALOG.length).toBeGreaterThanOrEqual(8);
    const widgetIds = MASTER_WIDGET_CATALOG.map((w) => w.id);
    expect(widgetIds).toContain("command-center-alerts");
    expect(widgetIds).toContain("smart-kpi-summary");
    expect(widgetIds).toContain("quick-actions-bar");
    expect(widgetIds).toContain("revenue-cost-trajectory");
    expect(widgetIds).toContain("portfolio-health");
  });

  it("should have tailored default widgets for every enterprise user role", () => {
    const roles: DashboardRole[] = ["owner", "manager", "accountant", "veterinarian", "staff", "partner"];

    roles.forEach((role) => {
      const widgets = ROLE_DEFAULT_WIDGETS[role];
      expect(Array.isArray(widgets)).toBe(true);
      expect(widgets.length).toBeGreaterThan(0);
    });

    // Owner should have complete operational & financial visibility
    expect(ROLE_DEFAULT_WIDGETS.owner).toContain("revenue-cost-trajectory");
    expect(ROLE_DEFAULT_WIDGETS.owner).toContain("portfolio-health");

    // Veterinarian should prioritize health and schedule over financial trajectory
    expect(ROLE_DEFAULT_WIDGETS.veterinarian).toContain("portfolio-health");
    expect(ROLE_DEFAULT_WIDGETS.veterinarian).toContain("today-tasks-agenda");

    // Partner/Investor should prioritize KPI metrics & revenue trajectory
    expect(ROLE_DEFAULT_WIDGETS.partner).toContain("smart-kpi-summary");
    expect(ROLE_DEFAULT_WIDGETS.partner).toContain("revenue-cost-trajectory");
  });
});

