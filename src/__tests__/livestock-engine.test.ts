import { LifecycleEngine } from "@/lib/livestock/lifecycle-engine";
import { GrowthEngine } from "@/lib/livestock/growth-engine";
import { HealthEngine } from "@/lib/livestock/health-engine";
import { BreedingEngine } from "@/lib/livestock/breeding-engine";
import { CostAttributionEngine } from "@/lib/livestock/cost-attribution-engine";
import { LivestockEventBus } from "@/lib/livestock/events";
import { CattleDomainService } from "@/lib/services/cattle.service";
import { InvalidStatusTransitionError, InvalidWeightLogError, WithdrawalPeriodActiveError } from "@/lib/livestock/errors";
import { ValidationError } from "@/lib/errors/app-error";

describe("Phase 5: Livestock Lifecycle Engine", () => {
  test("Validates permitted state transitions", () => {
    expect(LifecycleEngine.validateTransition("active", "sold")).toBe(true);
    expect(LifecycleEngine.validateTransition("active", "dead")).toBe(true);
    expect(LifecycleEngine.validateTransition("stolen", "active")).toBe(true);
  });

  test("Rejects illegal status transitions (e.g. from sold to active)", () => {
    expect(() => {
      LifecycleEngine.validateTransition("sold", "active");
    }).toThrow(InvalidStatusTransitionError);
  });

  test("Asserts sale eligibility against withdrawal period", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    expect(() => {
      LifecycleEngine.assertSaleEligibility("TAG-101", "active", tomorrowIso);
    }).toThrow(WithdrawalPeriodActiveError);
  });
});

describe("Phase 5: Growth & Schaeffer Weight Engine", () => {
  test("Calculates weight from tape using Schaeffer formula", () => {
    const wt = GrowthEngine.calculateWeightFromTape(160, 140);
    expect(wt).toBeGreaterThan(320);
    expect(wt).toBeLessThan(340);
  });

  test("Throws error on invalid tape dimensions", () => {
    expect(() => {
      GrowthEngine.calculateWeightFromTape(0, 140);
    }).toThrow(InvalidWeightLogError);
  });

  test("Computes growth metrics and Average Daily Gain (ADG)", () => {
    const logs = [
      { cattleId: "c-1", weightKg: 250, recordedAt: "2026-01-01" },
      { cattleId: "c-1", weightKg: 280, recordedAt: "2026-01-31" }, // 30 kg gain over 30 days = 1.0 kg/day
    ];

    const metrics = GrowthEngine.computeGrowthMetrics(
      250,
      "2026-01-01",
      logs,
      new Date("2026-02-10T00:00:00"),
      350 // Target slaughter weight
    );

    expect(metrics.currentWeightKg).toBe(280);
    expect(metrics.totalGainKg).toBe(30);
    expect(metrics.averageDailyGainKg).toBe(1);
    expect(metrics.daysToTargetSlaughter).toBe(60);
  });
});

describe("Phase 5: Health & Bio-Security Engine", () => {
  test("Generates standard intake protocol with correct day offsets", () => {
    const protocol = HealthEngine.generateIntakeProtocol("c-1", "biz-1", "2026-01-01");
    expect(protocol.length).toBeGreaterThan(4);
    expect(protocol[0].scheduledAt).toBe("2026-01-01"); // Day 0: Initial Checkup
    expect(protocol[1].scheduledAt).toBe("2026-01-03"); // Day 2: Deworming
  });

  test("Calculates withdrawal period dates correctly", () => {
    const withdrawal = HealthEngine.calculateWithdrawalPeriod("2026-01-01", 14);
    expect(withdrawal).toBe("2026-01-15");
  });

  test("Evaluates active withdrawal status correctly", () => {
    expect(HealthEngine.isUnderWithdrawal("2099-01-01")).toBe(true);
    expect(HealthEngine.isUnderWithdrawal("2020-01-01")).toBe(false);
    expect(HealthEngine.isUnderWithdrawal(null)).toBe(false);
  });
});

describe("Phase 5: Breeding & Gestation Engine", () => {
  test("Calculates Expected Calving Date (ECD) based on 283-day gestation", () => {
    const ecd = BreedingEngine.calculateExpectedCalvingDate("2026-01-01");
    expect(ecd).toBe("2026-10-11");
  });

  test("Calculates Pregnancy Diagnosis (PD) check date (45 days)", () => {
    const pd = BreedingEngine.calculatePDCheckDate("2026-01-01");
    expect(pd).toBe("2026-02-15");
  });

  test("Calculates 60-day dry off period prior to calving", () => {
    const dryOff = BreedingEngine.calculateDryOffDate("2026-10-11");
    expect(dryOff).toBe("2026-08-12");
  });
});

describe("Phase 5: Cost Attribution Engine", () => {
  test("Compiles total direct and allocated costs per head", () => {
    const summary = CostAttributionEngine.calculateAnimalCost(
      "c-1",
      80_000, // Purchase price
      350,    // Live weight (kg)
      [
        { cattleId: "c-1", category: "feed", amount: 15_000 },
        { cattleId: "c-1", category: "medicine", amount: 2_500 },
      ],
      2_500   // Allocated farm overhead
    );

    expect(summary.purchaseCost).toBe(80_000);
    expect(summary.directFeedCost).toBe(15_000);
    expect(summary.directMedicineCost).toBe(2_500);
    expect(summary.allocatedOverheadCost).toBe(2_500);
    expect(summary.totalAccumulatedCost).toBe(100_000);
    expect(summary.costPerKgLiveWeight).toBe(285.71); // 100,000 / 350
  });

  test("Allocates farm overhead per head count accurately", () => {
    expect(CostAttributionEngine.allocateOverheadPerHead(50_000, 20)).toBe(2500);
    expect(CostAttributionEngine.allocateOverheadPerHead(0, 20)).toBe(0);
  });
});

describe("Phase 5: Central Cattle Domain Service", () => {
  test("Validates registration input properly", () => {
    expect(() => {
      CattleDomainService.validateRegistration({
        tagId: "",
        purchasePrice: 1000,
        initialWeightKg: 200,
        purchaseDate: "2026-01-01",
      });
    }).toThrow(ValidationError);

    expect(() => {
      CattleDomainService.validateRegistration({
        tagId: "TAG-1",
        purchasePrice: -100,
        initialWeightKg: 200,
        purchaseDate: "2026-01-01",
      });
    }).toThrow(ValidationError);
  });

  test("Validates weight log inputs", () => {
    expect(() => {
      CattleDomainService.validateWeightLog(0, "2026-01-01");
    }).toThrow(ValidationError);

    expect(() => {
      CattleDomainService.validateWeightLog(2500, "2026-01-01");
    }).toThrow(ValidationError);
  });
});

describe("Phase 5: Livestock Event Bus", () => {
  test("Dispatches and captures livestock lifecycle events", async () => {
    const events: any[] = [];
    const unsubscribe = LivestockEventBus.subscribe("WeightRecorded", (e) => {
      events.push(e);
    });

    await LivestockEventBus.publish("WeightRecorded", "biz-1", "cattle-123", { weightKg: 310 }, "user-1");

    expect(events.length).toBe(1);
    expect(events[0].payload.weightKg).toBe(310);

    unsubscribe();
  });
});

describe("Sprint 07: RBAC & Extended Lifecycle Tests", () => {
  test("Validates RBAC permissions for all livestock roles", () => {
    const ownerPerms = LifecycleEngine.getRolePermissions("owner");
    expect(ownerPerms.canCreateAnimal).toBe(true);
    expect(ownerPerms.canHardDelete).toBe(true);
    expect(ownerPerms.canManageFarmsAndPens).toBe(true);

    const vetPerms = LifecycleEngine.getRolePermissions("veterinarian");
    expect(vetPerms.canCreateAnimal).toBe(false);
    expect(vetPerms.canAdministerHealth).toBe(true);
    expect(vetPerms.canManageBreeding).toBe(true);
    expect(vetPerms.canViewFinancials).toBe(false);

    const staffPerms = LifecycleEngine.getRolePermissions("staff");
    expect(staffPerms.canCreateAnimal).toBe(true);
    expect(staffPerms.canRecordWeight).toBe(true);
    expect(staffPerms.canAdministerHealth).toBe(false);
    expect(staffPerms.canViewFinancials).toBe(false);

    const viewerPerms = LifecycleEngine.getRolePermissions("viewer");
    expect(viewerPerms.canCreateAnimal).toBe(false);
    expect(viewerPerms.canRecordWeight).toBe(false);
  });

  test("Validates extended status transitions for quarantine and archival", () => {
    expect(LifecycleEngine.validateTransition("active", "quarantined")).toBe(true);
    expect(LifecycleEngine.validateTransition("quarantined", "active")).toBe(true);
    expect(LifecycleEngine.validateTransition("active", "archived")).toBe(true);
    expect(LifecycleEngine.validateTransition("sold", "archived")).toBe(true);
    expect(LifecycleEngine.validateTransition("dead", "archived")).toBe(true);

    expect(() => {
      LifecycleEngine.validateTransition("archived", "active");
    }).toThrow(InvalidStatusTransitionError);
  });
});
