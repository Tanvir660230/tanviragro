import { LifecycleEngine } from "@/lib/livestock/lifecycle-engine";
import { TimelineEngine, type RawAnimalTimelineData } from "@/lib/livestock/timeline-engine";
import {
  InvalidStatusTransitionError,
  WithdrawalPeriodActiveError,
  UnauthorizedLifecycleTransitionError,
  BreedingAgeViolationError,
  LifecycleBusinessRuleError,
  LifecycleDateSanityError,
} from "@/lib/livestock/errors";

describe("Sprint 11: Enterprise Animal Lifecycle Engine", () => {
  describe("State Transition Matrix & FSM Rules", () => {
    test("Permits valid state transitions from active", () => {
      expect(LifecycleEngine.validateTransition("active", "quarantined")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "sold")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "dead")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "stolen")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "culled")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "archived")).toBe(true);
      expect(LifecycleEngine.validateTransition("active", "active")).toBe(true);
    });

    test("Permits valid transitions from quarantined", () => {
      expect(LifecycleEngine.validateTransition("quarantined", "active")).toBe(true);
      expect(LifecycleEngine.validateTransition("quarantined", "sold")).toBe(true);
      expect(LifecycleEngine.validateTransition("quarantined", "dead")).toBe(true);
      expect(LifecycleEngine.validateTransition("quarantined", "culled")).toBe(true);
    });

    test("Permits recovery transitions from stolen and culled", () => {
      expect(LifecycleEngine.validateTransition("stolen", "active")).toBe(true);
      expect(LifecycleEngine.validateTransition("culled", "sold")).toBe(true);
      expect(LifecycleEngine.validateTransition("culled", "dead")).toBe(true);
    });

    test("Permits archival from terminal states", () => {
      expect(LifecycleEngine.validateTransition("sold", "archived")).toBe(true);
      expect(LifecycleEngine.validateTransition("dead", "archived")).toBe(true);
      expect(LifecycleEngine.validateTransition("stolen", "archived")).toBe(true);
      expect(LifecycleEngine.validateTransition("culled", "archived")).toBe(true);
    });

    test("Rejects illegal transitions from terminal states", () => {
      expect(() => LifecycleEngine.validateTransition("sold", "active")).toThrow(
        InvalidStatusTransitionError
      );
      expect(() => LifecycleEngine.validateTransition("dead", "active")).toThrow(
        InvalidStatusTransitionError
      );
      expect(() => LifecycleEngine.validateTransition("archived", "active")).toThrow(
        InvalidStatusTransitionError
      );
      expect(() => LifecycleEngine.validateTransition("archived", "sold")).toThrow(
        InvalidStatusTransitionError
      );
    });
  });

  describe("Role-Based Access Control (RBAC) Enforcement", () => {
    test("Owner has full lifecycle authority", () => {
      const perms = LifecycleEngine.getRolePermissions("owner");
      expect(perms.canChangeLifecycleStatus).toBe(true);
      expect(perms.canArchiveAnimal).toBe(true);
      expect(perms.canRecordSale).toBe(true);
      expect(perms.canRecordDeath).toBe(true);
      expect(LifecycleEngine.canRoleExecuteTransition("owner", "active", "archived")).toBe(true);
    });

    test("Manager can execute operational transitions but cannot archive", () => {
      const perms = LifecycleEngine.getRolePermissions("manager");
      expect(perms.canChangeLifecycleStatus).toBe(true);
      expect(perms.canArchiveAnimal).toBe(false);
      expect(perms.canRecordSale).toBe(true);
      expect(perms.canRecordDeath).toBe(true);
      expect(LifecycleEngine.canRoleExecuteTransition("manager", "active", "sold")).toBe(true);
      expect(LifecycleEngine.canRoleExecuteTransition("manager", "active", "archived")).toBe(false);
    });

    test("Veterinarian can change health/quarantine/death but cannot sell", () => {
      const perms = LifecycleEngine.getRolePermissions("veterinarian");
      expect(perms.canAdministerHealth).toBe(true);
      expect(perms.canRecordDeath).toBe(true);
      expect(perms.canRecordSale).toBe(false);
      expect(LifecycleEngine.canRoleExecuteTransition("veterinarian", "active", "quarantined")).toBe(true);
      expect(LifecycleEngine.canRoleExecuteTransition("veterinarian", "active", "dead")).toBe(true);
      expect(LifecycleEngine.canRoleExecuteTransition("veterinarian", "active", "sold")).toBe(false);
    });

    test("Staff and Viewer cannot execute privileged status transitions", () => {
      const staffPerms = LifecycleEngine.getRolePermissions("staff");
      expect(staffPerms.canChangeLifecycleStatus).toBe(false);
      expect(LifecycleEngine.canRoleExecuteTransition("staff", "active", "sold")).toBe(false);

      const viewerPerms = LifecycleEngine.getRolePermissions("viewer");
      expect(viewerPerms.canChangeLifecycleStatus).toBe(false);
      expect(LifecycleEngine.canRoleExecuteTransition("viewer", "active", "dead")).toBe(false);
    });

    test("validateTransition throws UnauthorizedLifecycleTransitionError when role lacks permission", () => {
      expect(() =>
        LifecycleEngine.validateTransition("active", "sold", "veterinarian")
      ).toThrow(UnauthorizedLifecycleTransitionError);

      expect(() =>
        LifecycleEngine.validateTransition("active", "sold", "staff")
      ).toThrow(UnauthorizedLifecycleTransitionError);
    });
  });

  describe("Business Rule Assertions", () => {
    test("Enforces sale eligibility with active drug withdrawal embargo", () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
      expect(() =>
        LifecycleEngine.assertSaleEligibility("TAG-001", "active", futureDate)
      ).toThrow(WithdrawalPeriodActiveError);

      const pastDate = "2020-01-01";
      expect(() =>
        LifecycleEngine.assertSaleEligibility("TAG-001", "active", pastDate)
      ).not.toThrow();
    });

    test("Enforces sale eligibility on non-active statuses", () => {
      expect(() => LifecycleEngine.assertSaleEligibility("TAG-001", "dead")).toThrow(
        InvalidStatusTransitionError
      );
      expect(() => LifecycleEngine.assertSaleEligibility("TAG-001", "sold")).toThrow(
        InvalidStatusTransitionError
      );
    });

    test("Enforces breeding age and weight eligibility", () => {
      const youngDob = new Date(Date.now() - 86400000 * 180).toISOString().slice(0, 10);
      expect(() =>
        LifecycleEngine.assertBreedingEligibility("TAG-002", "female", youngDob, 300)
      ).toThrow(BreedingAgeViolationError);

      const matureDob = new Date(Date.now() - 86400000 * 550).toISOString().slice(0, 10);
      expect(() =>
        LifecycleEngine.assertBreedingEligibility("TAG-003", "female", matureDob, 180)
      ).toThrow(LifecycleBusinessRuleError);

      expect(() =>
        LifecycleEngine.assertBreedingEligibility("TAG-004", "female", matureDob, 280)
      ).not.toThrow();
    });

    test("Enforces date sanity constraints", () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
      expect(() => LifecycleEngine.assertDateSanity(futureDate)).toThrow(LifecycleDateSanityError);

      expect(() =>
        LifecycleEngine.assertDateSanity("2024-01-01", "2023-01-01")
      ).toThrow(LifecycleDateSanityError);

      expect(() =>
        LifecycleEngine.assertDateSanity("2022-01-01", "2023-01-01", "2022-05-01")
      ).toThrow(LifecycleDateSanityError);
    });

    test("Enforces death assertion constraints", () => {
      expect(() => LifecycleEngine.assertDeathEligibility("TAG-005", "dead")).toThrow(
        LifecycleBusinessRuleError
      );
      expect(() => LifecycleEngine.assertDeathEligibility("TAG-005", "archived")).toThrow(
        LifecycleBusinessRuleError
      );
      expect(() => LifecycleEngine.assertDeathEligibility("TAG-005", "active")).not.toThrow();
    });
  });

  describe("Unified Chronological Timeline Compilation", () => {
    const mockData: RawAnimalTimelineData = {
      cattle: {
        id: "c-100",
        tag_id: "COW-99",
        dob: "2022-01-15",
        purchase_date: "2022-06-01",
        purchase_price: 65000,
        initial_weight_kg: 180,
        status: "active",
        breed: "Brahman",
        gender: "female",
      },
      weightLogs: [
        { id: "w-1", recorded_at: "2022-07-01", weight_kg: 205, girth_cm: 150 },
        { id: "w-2", recorded_at: "2022-09-01", weight_kg: 245, girth_cm: 162 },
      ],
      healthEvents: [
        {
          id: "h-1",
          title: "FMD Vaccine",
          event_type: "vaccination",
          scheduled_at: "2022-06-15",
          completed_at: "2022-06-15",
          cost_bdt: 250,
        },
      ],
      breedingRecords: [
        {
          id: "b-1",
          insemination_date: "2023-01-10",
          insemination_type: "AI",
          sire_tag_or_breed: "Angus #44",
          is_pregnant: true,
          actual_calving_date: "2023-10-18",
        },
      ],
      auditLogs: [
        {
          id: "a-1",
          action: "STATUS_CHANGE",
          actor_id: "user-1",
          actor_role: "veterinarian",
          previous_state: { status: "quarantined" },
          new_state: { status: "active", reason: "Isolation clearance" },
          timestamp: "2022-06-10T10:00:00Z",
        },
      ],
    };

    test("Compiles all records into sorted chronological timeline", () => {
      const timeline = TimelineEngine.compileUnifiedTimeline(mockData);
      expect(timeline.length).toBe(8); // Birth, Purchase, 2 weights, 1 vaccine, 1 breeding + 1 calving, 1 audit

      const timestamps = timeline.map((e) => new Date(e.timestamp).getTime());
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    test("Filters timeline events by category", () => {
      const healthEvents = TimelineEngine.compileUnifiedTimeline(mockData, "health");
      expect(healthEvents.length).toBe(1);
      expect(healthEvents[0].eventType).toBe("VACCINATION");

      const growthEvents = TimelineEngine.compileUnifiedTimeline(mockData, "growth");
      expect(growthEvents.length).toBe(2);
      expect(growthEvents[0].eventType).toBe("WEIGHT_ENTRY");

      const breedingEvents = TimelineEngine.compileUnifiedTimeline(mockData, "breeding");
      expect(breedingEvents.length).toBe(2);
    });
  });
});