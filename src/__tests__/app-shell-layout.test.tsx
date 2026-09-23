import {
  ShellProvider,
  useShell,
  PageContainer,
  EnterprisePageHeader,
  PageContent,
  PageFooter,
  FilterBar,
  SummaryBar,
  AppShell,
  RightUtilityPanel,
  AppShortcuts,
  DashboardHeader,
  EnterprisePageTemplate,
  GlobalCommandSearch,
  QuickCreateMenu,
  NotificationCenter,
  UserProfileMenu,
} from "@/components/layout";

describe("Global Application Shell & Enterprise Layout System (Master Prompt 003)", () => {
  it("exports all foundational shell components and containers", () => {
    expect(ShellProvider).toBeDefined();
    expect(typeof ShellProvider).toBe("function");

    expect(useShell).toBeDefined();
    expect(typeof useShell).toBe("function");

    expect(AppShell).toBeDefined();
    expect(typeof AppShell).toBe("function");

    expect(DashboardHeader).toBeDefined();
    expect(typeof DashboardHeader).toBe("function");

    expect(GlobalCommandSearch).toBeDefined();
    expect(typeof GlobalCommandSearch).toBe("function");

    expect(QuickCreateMenu).toBeDefined();
    expect(typeof QuickCreateMenu).toBe("function");

    expect(NotificationCenter).toBeDefined();
    expect(typeof NotificationCenter).toBe("function");

    expect(UserProfileMenu).toBeDefined();
    expect(typeof UserProfileMenu).toBe("function");

    expect(EnterprisePageTemplate).toBeDefined();
    expect(typeof EnterprisePageTemplate).toBe("function");

    expect(RightUtilityPanel).toBeDefined();
    expect(typeof RightUtilityPanel).toBe("function");

    expect(AppShortcuts).toBeDefined();
    expect(typeof AppShortcuts).toBe("function");
  });

  it("exports all enterprise page template components", () => {
    expect(PageContainer).toBeDefined();
    expect(typeof PageContainer).toBe("function");

    expect(EnterprisePageHeader).toBeDefined();
    expect(typeof EnterprisePageHeader).toBe("function");

    expect(PageContent).toBeDefined();
    expect(typeof PageContent).toBe("function");

    expect(PageFooter).toBeDefined();
    expect(typeof PageFooter).toBe("function");

    expect(FilterBar).toBeDefined();
    expect(typeof FilterBar).toBe("function");

    expect(SummaryBar).toBeDefined();
    expect(typeof SummaryBar).toBe("function");
  });
});

