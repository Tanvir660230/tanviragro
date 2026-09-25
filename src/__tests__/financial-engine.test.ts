import { FinancialEventBus } from "@/lib/financial/events";

describe("Phase 3: Financial Event Bus", () => {
  test("FinancialEventBus dispatches and receives events cleanly", async () => {
    const received: any[] = [];
    const unsubscribe = FinancialEventBus.subscribe("ExpenseCreated", (evt) => {
      received.push(evt);
    });

    await FinancialEventBus.publish(
      "ExpenseCreated",
      "biz-123",
      { costId: "c-100", amount: 5000, category: "Feed" },
      "user-1"
    );

    expect(received.length).toBe(1);
    expect(received[0].payload.amount).toBe(5000);
    expect(received[0].businessId).toBe("biz-123");

    unsubscribe();

    await FinancialEventBus.publish("ExpenseCreated", "biz-123", { costId: "c-101" });
    expect(received.length).toBe(1);
  });
});