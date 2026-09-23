import { integrationPlatform } from "@/lib/integrations/integration-platform";

describe("Enterprise Integration Platform (Phase 13)", () => {
  it("registers webhook handlers and processes payloads with audit logging", async () => {
    let handled = false;
    integrationPlatform.registerWebhookHandler("payment.received", async (payload) => {
      handled = true;
      return {
        success: true,
        message: `Processed payment ${(payload.data as any)?.amount}`,
        processedAt: new Date().toISOString(),
      };
    });

    const results = await integrationPlatform.processWebhook({
      id: "wh_test_101",
      source: "payment_gateway",
      event: "payment.received",
      businessId: "biz_test_01",
      data: { amount: 50000, reference: "INV-2026" },
      timestamp: new Date().toISOString(),
    });

    expect(handled).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].success).toBe(true);
  });
});
