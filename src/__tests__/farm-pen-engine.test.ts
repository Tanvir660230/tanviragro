import { PenEngine, PenEntity } from "@/lib/livestock/pen-engine";

describe("Sprint 08: Multi-Farm & Pen Management Engine", () => {
  const mockPens: PenEntity[] = [
    {
      id: "pen-1",
      businessId: "biz-1",
      farmId: "farm-1",
      name: "Fattening Pen A",
      code: "F-A",
      type: "fattening",
      capacity: 20,
      currentOccupancy: 15,
      isActive: true,
    },
    {
      id: "pen-2",
      businessId: "biz-1",
      farmId: "farm-1",
      name: "Quarantine Pen Q1",
      code: "Q-1",
      type: "quarantine",
      capacity: 10,
      currentOccupancy: 9,
      isActive: true,
    },
    {
      id: "pen-3",
      businessId: "biz-1",
      farmId: "farm-1",
      name: "Isolation Bay",
      code: "ISO-1",
      type: "isolation",
      capacity: 5,
      currentOccupancy: 6, // Overcapacity test
      isActive: true,
    },
  ];

  test("Calculates pen occupancy metrics and status tiers correctly", () => {
    // Normal available
    const opt = PenEngine.calculatePenOccupancy(20, 10, "pen-1");
    expect(opt.occupancyRatePct).toBe(50);
    expect(opt.status).toBe("optimal");
    expect(opt.isNearCapacity).toBe(false);
    expect(opt.isOverCapacity).toBe(false);

    // Warning tier (85-99%)
    const warn = PenEngine.calculatePenOccupancy(10, 9, "pen-2");
    expect(warn.occupancyRatePct).toBe(90);
    expect(warn.status).toBe("warning");
    expect(warn.isNearCapacity).toBe(true);

    // Full tier (100%)
    const full = PenEngine.calculatePenOccupancy(10, 10, "pen-2");
    expect(full.occupancyRatePct).toBe(100);
    expect(full.status).toBe("full");

    // Overcapacity (>100%)
    const over = PenEngine.calculatePenOccupancy(5, 6, "pen-3");
    expect(over.occupancyRatePct).toBe(120);
    expect(over.status).toBe("overcapacity");
    expect(over.isOverCapacity).toBe(true);
  });

  test("Calculates farm-wide aggregated metrics", () => {
    const metrics = PenEngine.calculateFarmCapacity("farm-1", mockPens);
    expect(metrics.totalPens).toBe(3);
    expect(metrics.totalCapacity).toBe(35); // 20 + 10 + 5
    expect(metrics.totalOccupancy).toBe(30); // 15 + 9 + 6
    expect(metrics.availableCapacity).toBe(5);
    expect(metrics.overallOccupancyPct).toBe(85.7);
    expect(metrics.pensNearCapacityCount).toBe(1); // pen-2 at 90%
    expect(metrics.pensOverCapacityCount).toBe(1); // pen-3 at 120%
    expect(metrics.breakdownByType.fattening.count).toBe(1);
    expect(metrics.breakdownByType.quarantine.occupancy).toBe(9);
  });

  test("Validates animal movement with capacity and biosecurity rules", () => {
    const penA = mockPens[0];
    const isoPen = mockPens[2];

    // Valid movement (available space)
    const valid = PenEngine.validateAnimalMovement(penA, { tagId: "TAG-1" }, 2);
    expect(valid.isValid).toBe(true);
    expect(valid.errors.length).toBe(0);

    // Capacity overflow rejection
    const overflow = PenEngine.validateAnimalMovement(penA, { tagId: "TAG-1" }, 10);
    expect(overflow.isValid).toBe(false);
    expect(overflow.errors[0]).toContain("Insufficient capacity");

    // Contagious animal must go to isolation
    const contagiousToNormal = PenEngine.validateAnimalMovement(penA, {
      tagId: "TAG-99",
      isContagious: true,
    });
    expect(contagiousToNormal.isValid).toBe(false);
    expect(contagiousToNormal.errors[0]).toContain("Biosecurity violation");

    // Quarantined animal warning
    const quarantinedToNormal = PenEngine.validateAnimalMovement(penA, {
      tagId: "TAG-88",
      isQuarantined: true,
    });
    expect(quarantinedToNormal.isValid).toBe(true);
    expect(quarantinedToNormal.warnings.length).toBeGreaterThan(0);
  });
});
