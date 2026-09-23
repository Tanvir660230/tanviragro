import { telemetryService } from "@/lib/monitoring/telemetry";

describe("Telemetry & Distributed Observability (Phase 12)", () => {
  beforeEach(() => {
    // Clean slate where possible
  });

  it("records and scrubs error logs containing sensitive credentials", () => {
    const errorEntry = telemetryService.recordError(
      "Connection failed for Bearer eyJhbGciOiJIUzI1NiJ9.secret and token=supersecretpassword",
      "database",
      "critical"
    );

    expect(errorEntry).toBeDefined();
    expect(errorEntry.message).not.toContain("eyJhbGciOiJIUzI1NiJ9.secret");
    expect(errorEntry.message).not.toContain("supersecretpassword");
    expect(errorEntry.module).toBe("database");
    expect(errorEntry.severity).toBe("critical");
  });

  it("records and retrieves performance metrics", () => {
    telemetryService.recordPerformance("query", "livestock_batch_load", 145);
    const metrics = telemetryService.getPerformanceMetrics(10);

    expect(metrics.length).toBeGreaterThan(0);
    const recorded = metrics.find((m) => m.name === "livestock_batch_load");
    expect(recorded).toBeDefined();
    expect(recorded?.durationMs).toBe(145);
  });

  it("retrieves system resource metrics safely", () => {
    const sys = telemetryService.getSystemMetrics();
    expect(sys).toBeDefined();
    expect(sys.memory).toBeDefined();
    expect(typeof sys.memory.heapUsedMB).toBe("number");
    expect(typeof sys.uptimeSeconds).toBe("number");
  });
});
