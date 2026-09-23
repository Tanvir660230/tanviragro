import {
  enqueue,
  getAllQueued,
  updateMutationStatus,
  removeQueued,
  countQueued,
  clearQueue,
  type WeightLogPayload,
  type HealthEventPayload,
} from "@/lib/offlineQueue";

describe("Enterprise Offline-First Mutation Queue", () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it("enqueues a weight-log mutation with pending status", async () => {
    const payload: WeightLogPayload = {
      type: "weight-log",
      cattle_id: "c-001",
      weight_kg: 340.5,
      recorded_at: "2026-09-09",
      notes: "Morning scale measurement",
    };

    const item = await enqueue(payload, "biz_001");

    expect(item.id).toBeDefined();
    expect(item.status).toBe("pending");
    expect(item.retryCount).toBe(0);
    expect(item.businessId).toBe("biz_001");

    const total = await countQueued();
    expect(total).toBe(1);
  });

  it("enqueues multiple mutations and retrieves them in chronological order", async () => {
    const payload1: WeightLogPayload = {
      type: "weight-log",
      cattle_id: "c-001",
      weight_kg: 340,
      recorded_at: "2026-09-09",
    };
    const payload2: HealthEventPayload = {
      type: "health-event",
      cattle_id: "c-002",
      event_type: "vaccine",
      title: "Anthrax booster",
      scheduled_at: "2026-09-10",
    };

    await enqueue(payload1);
    await enqueue(payload2);

    const queued = await getAllQueued();
    expect(queued).toHaveLength(2);
    expect(queued[0].payload.type).toBe("weight-log");
    expect(queued[1].payload.type).toBe("health-event");
  });

  it("updates mutation status and tracks retry count on failure", async () => {
    const payload: WeightLogPayload = {
      type: "weight-log",
      cattle_id: "c-001",
      weight_kg: 340,
      recorded_at: "2026-09-09",
    };

    const item = await enqueue(payload);
    await updateMutationStatus(item.id, "failed", "Network timeout");

    const queued = await getAllQueued();
    expect(queued[0].status).toBe("failed");
    expect(queued[0].retryCount).toBe(1);
    expect(queued[0].lastError).toBe("Network timeout");
  });

  it("removes mutation upon successful sync", async () => {
    const payload: WeightLogPayload = {
      type: "weight-log",
      cattle_id: "c-001",
      weight_kg: 340,
      recorded_at: "2026-09-09",
    };

    const item = await enqueue(payload);
    expect(await countQueued()).toBe(1);

    await removeQueued(item.id);
    expect(await countQueued()).toBe(0);
  });
});
