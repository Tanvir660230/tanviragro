import { notificationEngine } from "@/lib/notifications/engine";

describe("Phase 9: Enterprise Notification, Workflow & Automation Engine", () => {
  it("compiles notification templates with variable substitution", () => {
    const rendered = notificationEngine.renderTemplate("inventory_low_stock", {
      name: "Silage Feed",
      stock: 4.5,
      unit: "KG",
    });

    expect(rendered).not.toBeNull();
    expect(rendered?.title).toContain("Silage Feed");
    expect(rendered?.body).toContain("4.5 KG");
  });

  it("dispatches in-app notifications and maintains tenant isolation", async () => {
    const bizA = "biz_test_alpha";
    const bizB = "biz_test_beta";

    await notificationEngine.send({
      businessId: bizA,
      title: "Vaccination Due #TAG-101",
      body: "Anthrax booster due today.",
      category: "cattle",
      severity: "high",
      channels: ["in_app"],
    });

    const notifsA = notificationEngine.getInAppNotifications(bizA);
    const notifsB = notificationEngine.getInAppNotifications(bizB);

    expect(notifsA.length).toBeGreaterThanOrEqual(1);
    expect(notifsA[0].title).toBe("Vaccination Due #TAG-101");
    expect(notifsB.length).toBe(0);
  });

});

