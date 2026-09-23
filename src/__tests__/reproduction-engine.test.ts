import {
  GestationEngine,
  PedigreeEngine,
  FertilityAnalyticsEngine,
  ReproductionEngine,
  type BreedingAttempt,
  type CalvingRecord,
} from "@/lib/reproduction";

describe("Sprint 16: Reproduction, Breeding, Gestation & Pedigree Platform", () => {
  describe("GestationEngine", () => {
    test("Calculates Expected Calving Date (ECD) with default and breed-specific periods", () => {
      const ecdStandard = GestationEngine.calculateExpectedCalvingDate("2026-01-01");
      expect(ecdStandard).toBe("2026-10-11");

      const ecdHolstein = GestationEngine.calculateExpectedCalvingDate("2026-01-01", "Holstein Friesian");
      expect(ecdHolstein).toBe("2026-10-08");

      const ecdBrahman = GestationEngine.calculateExpectedCalvingDate("2026-01-01", "Brahman Cross");
      expect(ecdBrahman).toBe("2026-10-20");
    });

    test("Computes AM/PM breeding window accurately", () => {
      const amWindow = GestationEngine.calculateOptimalBreedingWindow("2026-05-10T08:00:00");
      expect(amWindow.description).toContain("AM Detection");

      const pmWindow = GestationEngine.calculateOptimalBreedingWindow("2026-05-10T17:00:00");
      expect(pmWindow.description).toContain("PM Detection");
    });

    test("Calculates PD check, Dry-Off, and Transition Diet dates", () => {
      const aiDate = "2026-01-01";
      const ecd = GestationEngine.calculateExpectedCalvingDate(aiDate);
      const pdDate = GestationEngine.calculatePDCheckDate(aiDate);
      const dryOff = GestationEngine.calculateDryOffDate(ecd);
      const transition = GestationEngine.calculateTransitionDietDate(ecd);

      expect(pdDate).toBe("2026-02-15");
      expect(dryOff).toBe("2026-08-12");
      expect(transition).toBe("2026-09-20");
    });

    test("Returns accurate gestation trimester and progress percentage", () => {
      const aiDate = "2026-01-01";
      const refDate = new Date("2026-04-11T00:00:00.000Z");
      const details = GestationEngine.getGestationDetails(aiDate, "Holstein", refDate);

      expect(details.gestationDays).toBe(100);
      expect(details.trimester).toBe("2nd Trimester");
      expect(details.percentComplete).toBe(Math.round((100 / 280) * 100));
      expect(details.isOverdue).toBe(false);
    });

    test("Predicts next recurring 21-day heat cycle if open", () => {
      const nextHeat = GestationEngine.predictNextHeatDate("2026-01-01", 1);
      expect(nextHeat).toBe("2026-01-22");

      const cycle2Heat = GestationEngine.predictNextHeatDate("2026-01-01", 2);
      expect(cycle2Heat).toBe("2026-02-12");
    });
  });

  describe("PedigreeEngine & Lineage Genetics", () => {
    const mockHerd = new Map<string, any>([
      ["calf-1", { id: "calf-1", tagNumber: "C-01", gender: "heifer", damId: "dam-1", sireId: "sire-1" }],
      ["dam-1",  { id: "dam-1",  tagNumber: "D-01", gender: "cow",    damId: "gdam-1", sireId: "gsire-1" }],
      ["sire-1", { id: "sire-1", tagNumber: "S-01", gender: "bull",   damId: "gdam-2", sireId: "gsire-2" }],
      ["gdam-1", { id: "gdam-1", tagNumber: "GD-01", gender: "cow" }],
      ["gsire-1",{ id: "gsire-1",tagNumber: "GS-01", gender: "bull" }],
      ["gdam-2", { id: "gdam-2", tagNumber: "GD-02", gender: "cow" }],
      ["gsire-2",{ id: "gsire-2",tagNumber: "GS-02", gender: "bull" }],
    ]);

    test("Constructs 3-generation recursive pedigree tree correctly", () => {
      const tree = PedigreeEngine.buildPedigreeTree("calf-1", mockHerd, 3);
      expect(tree).not.toBeNull();
      expect(tree?.tagNumber).toBe("C-01");
      expect(tree?.dam?.tagNumber).toBe("D-01");
      expect(tree?.sire?.tagNumber).toBe("S-01");
      expect(tree?.dam?.dam?.tagNumber).toBe("GD-01");
      expect(tree?.sire?.sire?.tagNumber).toBe("GS-02");
    });

    test("Prevents self-mating with critical risk score", () => {
      const evalSelf = PedigreeEngine.evaluateMatingCompatibility("dam-1", "dam-1", mockHerd);
      expect(evalSelf.isMatingRecommended).toBe(false);
      expect(evalSelf.riskLevel).toBe("critical");
      expect(evalSelf.inbreedingPercentage).toBe(100);
    });

    test("Detects direct Parent-Offspring inbreeding (F = 25%)", () => {
      const evalParent = PedigreeEngine.evaluateMatingCompatibility("calf-1", "sire-1", mockHerd);
      expect(evalParent.isMatingRecommended).toBe(false);
      expect(evalParent.inbreedingPercentage).toBe(25.0);
      expect(evalParent.riskLevel).toBe("critical");
    });

    test("Permits unrelated mating with zero inbreeding risk", () => {
      const evalUnrelated = PedigreeEngine.evaluateMatingCompatibility("gdam-1", "gsire-2", mockHerd);
      expect(evalUnrelated.isMatingRecommended).toBe(true);
      expect(evalUnrelated.inbreedingCoefficient).toBe(0);
      expect(evalUnrelated.riskLevel).toBe("none");
    });
  });

  describe("FertilityAnalyticsEngine", () => {
    const mockAttempts: BreedingAttempt[] = [
      {
        id: "att-1",
        businessId: "biz-1",
        cowId: "cow-1",
        breedingType: "AI",
        sireTagOrCode: "BULL-A",
        inseminationDate: "2026-01-01",
        technicianName: "Dr. Karim",
        technicianCostBdt: 500,
        strawCostBdt: 1000,
        totalBreedingCostBdt: 1500,
        attemptNumberInCycle: 1,
        status: "pregnancy_confirmed",
        pdCheckScheduledDate: "2026-02-15",
        pdResult: "pregnant",
        expectedCalvingDate: "2026-10-11",
        dryOffDate: "2026-08-12",
        pregnancyRiskLevel: "normal",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-02-15T00:00:00Z",
      },
      {
        id: "att-2",
        businessId: "biz-1",
        cowId: "cow-2",
        breedingType: "AI",
        sireTagOrCode: "BULL-A",
        inseminationDate: "2026-01-05",
        technicianName: "Dr. Karim",
        technicianCostBdt: 500,
        strawCostBdt: 1000,
        totalBreedingCostBdt: 1500,
        attemptNumberInCycle: 1,
        status: "pregnancy_failed",
        pdCheckScheduledDate: "2026-02-19",
        pdResult: "open",
        expectedCalvingDate: "2026-10-15",
        dryOffDate: "2026-08-16",
        pregnancyRiskLevel: "normal",
        createdAt: "2026-01-05T00:00:00Z",
        updatedAt: "2026-02-19T00:00:00Z",
      },
    ];

    test("Calculates conception rates and technician leaderboard", () => {
      const metrics = FertilityAnalyticsEngine.calculateHerdFertilityMetrics(mockAttempts, [], 1);
      expect(metrics.totalBreedingAttempts).toBe(2);
      expect(metrics.conceptionRatePercent).toBe(50.0);
      expect(metrics.firstServiceConceptionRatePercent).toBe(50.0);
      expect(metrics.servicesPerConception).toBe(2.0);
      expect(metrics.technicianSuccessLeaderboard[0].technicianName).toBe("Dr. Karim");
      expect(metrics.technicianSuccessLeaderboard[0].successRate).toBe(50.0);
    });
  });
});
