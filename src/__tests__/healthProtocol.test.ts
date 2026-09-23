import { buildProtocolEvents, DEFAULT_HEALTH_PROTOCOL } from "@/lib/healthProtocol";

describe("Health Protocol Engine", () => {
  it("generates correct scheduled dates based on purchase date", () => {
    const purchaseDate = "2024-03-01";
    const events = buildProtocolEvents("c-123", "b-456", purchaseDate);

    expect(events.length).toBe(DEFAULT_HEALTH_PROTOCOL.length);
    expect(events[0].cattle_id).toBe("c-123");
    expect(events[0].business_id).toBe("b-456");
    expect(events[0].scheduled_at).toBe("2024-03-01"); // Day 0

    // Day 2 check
    expect(events[1].scheduled_at).toBe("2024-03-03");
    expect(events[1].event_type).toBe("deworming");

    // Day 7 check
    expect(events[2].scheduled_at).toBe("2024-03-08");
    expect(events[2].event_type).toBe("vaccine");
  });

  it("handles custom protocols correctly", () => {
    const custom = [
      { dayOffset: 5, title: "Custom Check", eventType: "checkup" as const, notes: "Custom note" },
    ];
    const events = buildProtocolEvents("c-1", "b-1", "2024-05-10", custom);
    expect(events.length).toBe(1);
    expect(events[0].scheduled_at).toBe("2024-05-15");
    expect(events[0].title).toBe("Custom Check");
  });
});
