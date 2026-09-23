import {
  calculateWeightFromTapeSchaeffer,
  calculateIntervalAdg,
  calculateGrowthStage,
  determinePerformanceTier,
  predictGrowthTrajectory,
  calculateFcr,
} from "@/lib/growth/calculator";
import { detectGrowthAnomalies } from "@/lib/growth/intelligence";
import { buildHerdGrowthAnalytics } from "@/lib/growth/growth-engine";

describe("Growth Intelligence Engine", () => {
  describe("Biometric Tape Estimation (Schaeffer Formula)", () => {
    it("should calculate estimated weight accurately from heart girth and body length", () => {
      // 180 cm girth (70.86 in), 150 cm length (59.05 in)
      const weight = calculateWeightFromTapeSchaeffer(180, 150);
      expect(weight).toBeGreaterThan(400);
      expect(weight).toBeLessThan(550);
    });

    it("should return 0 for non-positive dimensions", () => {
      expect(calculateWeightFromTapeSchaeffer(0, 150)).toBe(0);
      expect(calculateWeightFromTapeSchaeffer(180, -10)).toBe(0);
    });
  });

  describe("ADG and Performance Classification", () => {
    it("should calculate correct daily gain over interval", () => {
      const adg = calculateIntervalAdg(300, 330, "2026-01-01", "2026-01-31");
      // 30 kg gain over 30 days = 1.00 kg/day
      expect(adg).toBeCloseTo(1.0, 2);
    });

    it("should assign correct growth stages according to weight taxonomy", () => {
      expect(calculateGrowthStage(120)).toBe("calf");
      expect(calculateGrowthStage(200)).toBe("weaner");
      expect(calculateGrowthStage(350)).toBe("grower");
      expect(calculateGrowthStage(480)).toBe("finisher");
    });

    it("should assign performance tiers correctly based on ADG", () => {
      expect(determinePerformanceTier(1.30, "grower")).toBe("elite");
      expect(determinePerformanceTier(0.95, "grower")).toBe("above_average");
      expect(determinePerformanceTier(0.70, "grower")).toBe("standard");
      expect(determinePerformanceTier(0.45, "grower")).toBe("underperforming");
      expect(determinePerformanceTier(0.20, "grower")).toBe("critical");
    });

    it("should calculate feed conversion ratio (FCR)", () => {
      const fcr = calculateFcr(70, 10);
      expect(fcr).toBe(7.0);
    });
  });

  describe("Growth Trajectory Prediction", () => {
    it("should project target finish date and required gain", () => {
      const records = [
        { id: "1", cattle_id: "c1", recorded_at: "2026-01-01", weight_kg: 350, weighing_method: "scale" as const },
        { id: "2", cattle_id: "c1", recorded_at: "2026-02-01", weight_kg: 380, weighing_method: "scale" as const },
      ];
      const trajectory = predictGrowthTrajectory("c1", "TAG-101", records, 500);

      expect(trajectory.currentWeightKg).toBe(380);
      expect(trajectory.predicted30dKg).toBeGreaterThan(380);
      expect(trajectory.daysToTarget).toBeDefined();
    });
  });

  describe("Anomaly Detection", () => {
    it("should detect rapid weight loss anomaly", () => {
      const logs = [
        { id: "1", cattle_id: "c1", recorded_at: "2026-01-01", weight_kg: 400, weighing_method: "scale" as const },
        { id: "2", cattle_id: "c1", recorded_at: "2026-01-15", weight_kg: 370, weighing_method: "scale" as const }, // -30kg in 14 days
      ];
      const alerts = detectGrowthAnomalies("c1", "TAG-101", logs, null, "2026-01-16");
      const lossAlert = alerts.find((a) => a.type === "rapid_loss");
      expect(lossAlert).toBeDefined();
      expect(lossAlert?.severity).toBe("critical");
    });

    it("should detect overdue weigh-in", () => {
      const logs = [
        { id: "1", cattle_id: "c2", recorded_at: "2025-10-01", weight_kg: 350, weighing_method: "scale" as const },
      ];
      const alerts = detectGrowthAnomalies("c2", "TAG-102", logs, null, "2026-01-01");
      const overdueAlert = alerts.find((a) => a.type === "missed_measurement");
      expect(overdueAlert).toBeDefined();
    });
  });

  describe("Herd Analytics Aggregator", () => {
    it("should aggregate herd performance and generate pen benchmarks", () => {
      const animals = [
        {
          id: "c1",
          tag_id: "TAG-001",
          name: "Bull 1",
          breed: "Brahman",
          gender: "male",
          dob: null,
          status: "active" as const,
          initial_weight_kg: 300,
          current_weight_kg: 360,
          birth_date: null,
          purchase_date: "2026-01-01",
          pen_name: "Pen Alpha",
        },
      ];

      const logs = [
        { id: "w1", cattle_id: "c1", recorded_at: "2026-01-01", weight_kg: 300, weighing_method: "scale" as const },
        { id: "w2", cattle_id: "c1", recorded_at: "2026-03-02", weight_kg: 360, weighing_method: "scale" as const },
      ];

      const herd = buildHerdGrowthAnalytics(animals as any, logs, [], []);
      expect(herd.summary.totalActiveAnimals).toBe(1);
      expect(herd.summary.herdAvgWeightKg).toBe(360);
      expect(herd.penBenchmarks.length).toBe(1);
      expect(herd.penBenchmarks[0].penName).toBe("Pen Alpha");
    });
  });
});


