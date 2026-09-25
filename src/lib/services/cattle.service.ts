import { GrowthEngine } from "@/lib/livestock/growth-engine";
import { HealthEngine } from "@/lib/livestock/health-engine";
import { LifecycleEngine } from "@/lib/livestock/lifecycle-engine";
import { BreedingEngine } from "@/lib/livestock/breeding-engine";
import { CostAttributionEngine, type DirectCostEntry } from "@/lib/livestock/cost-attribution-engine";
import { LivestockEventBus } from "@/lib/livestock/events";
import { ValidationError } from "@/lib/errors/app-error";
import type { CattleStatus } from "@/types/database";
import { todayDhaka } from "@/lib/dates";

export class CattleDomainService {
  /**
   * Validates cattle registration parameters.
   */
  public static validateRegistration(input: {
    tagId: string;
    purchasePrice: number;
    initialWeightKg: number;
    purchaseDate: string;
  }): void {
    if (!input.tagId || input.tagId.trim().length === 0) {
      throw new ValidationError("Cattle Tag ID is required");
    }
    if (input.purchasePrice < 0) {
      throw new ValidationError("Purchase price cannot be negative");
    }
    if (input.initialWeightKg <= 0) {
      throw new ValidationError("Initial weight must be greater than zero kg");
    }
    const today = todayDhaka();
    if (input.purchaseDate > today) {
      throw new ValidationError("Purchase date cannot be in the future");
    }
  }

  /**
   * Validates weight log inputs.
   */
  public static validateWeightLog(weightKg: number, recordedAt: string): void {
    if (weightKg <= 0 || weightKg > 2000) {
      throw new ValidationError("Weight must be between 1 and 2,000 kg");
    }
    const today = todayDhaka();
    if (recordedAt > today) {
      throw new ValidationError("Weight recording date cannot be in the future");
    }
  }

  /**
   * Validates lifecycle status transition.
   */
  public static validateStatusTransition(currentStatus: CattleStatus, nextStatus: CattleStatus): boolean {
    return LifecycleEngine.validateTransition(currentStatus, nextStatus);
  }

  /**
   * Enforces sale eligibility (drug withdrawal embargo check).
   */
  public static assertSaleEligibility(tagId: string, status: CattleStatus, withdrawalUntil?: string | null): void {
    LifecycleEngine.assertSaleEligibility(tagId, status, withdrawalUntil);
  }

  /**
   * Calculates live weight from tape using Schaeffer formula.
   */
  public static calculateWeightFromTape(girthCm: number, lengthCm: number): number {
    return GrowthEngine.calculateWeightFromTape(girthCm, lengthCm);
  }

  /**
   * Generates standard intake vaccination schedule.
   */
  public static generateIntakeHealthProtocol(cattleId: string, businessId: string, purchaseDate: string) {
    return HealthEngine.generateIntakeProtocol(cattleId, businessId, purchaseDate);
  }

  /**
   * Calculates breeding milestones (ECD, PD check, dry-off).
   */
  public static calculateBreedingMilestones(inseminationDate: string) {
    const expectedCalvingDate = BreedingEngine.calculateExpectedCalvingDate(inseminationDate);
    const pdCheckDate = BreedingEngine.calculatePDCheckDate(inseminationDate);
    const dryOffDate = BreedingEngine.calculateDryOffDate(expectedCalvingDate);

    return {
      inseminationDate,
      expectedCalvingDate,
      pdCheckDate,
      dryOffDate,
    };
  }

  /**
   * Calculates per-head accumulated costs and break-even live weight metrics.
   */
  public static calculateCostAttribution(
    cattleId: string,
    purchaseCost: number,
    currentLiveWeightKg: number,
    costEntries: DirectCostEntry[],
    allocatedOverheadCost = 0
  ) {
    return CostAttributionEngine.calculateAnimalCost(
      cattleId,
      purchaseCost,
      currentLiveWeightKg,
      costEntries,
      allocatedOverheadCost
    );
  }

  /**
   * Emits livestock events to the central event bus.
   */
  public static async emitEvent(
    eventType: "CattleRegistered" | "WeightRecorded" | "HealthEventScheduled" | "BreedingInseminated" | "StatusChanged" | "CattleSold",
    businessId: string,
    cattleId: string,
    payload: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    await LivestockEventBus.publish(eventType, businessId, cattleId, payload, userId);
  }
}