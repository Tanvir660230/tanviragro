import type { TransitStatus, TransferType } from "./types";

export interface TransferChecklist {
  health_ok: boolean;
  injuries: boolean;
  feed_provided: boolean;
  water_provided: boolean;
  weight_verified?: boolean;
  quarantine_recommended?: boolean;
}

export interface TransferLogisticsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresQuarantine: boolean;
}

export class TransferLogisticsEngine {
  /**
   * Validates legal and operational transit requirements before dispatch
   */
  public static validateTransferDispatch(params: {
    transferType: TransferType;
    originName: string;
    destinationName: string;
    cattleCount: number;
    vehicleNumber?: string | null;
    driverName?: string | null;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.originName || !params.originName.trim()) {
      errors.push("Origin location is required");
    }
    if (!params.destinationName || !params.destinationName.trim()) {
      errors.push("Destination location is required");
    }
    if (params.originName.trim().toLowerCase() === params.destinationName.trim().toLowerCase()) {
      errors.push("Origin and destination cannot be identical");
    }
    if (params.cattleCount <= 0) {
      errors.push("At least one animal must be selected for transfer");
    }

    if (params.transferType === "sale_delivery" || params.transferType === "farm_to_farm") {
      if (!params.driverName || !params.driverName.trim()) {
        errors.push("Driver name is mandatory for inter-farm or delivery logistics");
      }
      if (!params.vehicleNumber || !params.vehicleNumber.trim()) {
        errors.push("Vehicle registration number is mandatory");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates arrival checklist & biosecurity protocols
   */
  public static validateArrivalInspection(
    checklist: TransferChecklist,
    notes?: string
  ): TransferLogisticsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!checklist.health_ok) {
      warnings.push("Animal showed abnormal health symptoms on arrival. Veterinary inspection required.");
    }
    if (checklist.injuries) {
      warnings.push("Physical abrasions or injury recorded during transport inspection.");
    }
    if (!checklist.water_provided || !checklist.feed_provided) {
      warnings.push("Hydration or feeding protocol was omitted in transit.");
    }

    const requiresQuarantine =
      checklist.quarantine_recommended === true ||
      !checklist.health_ok ||
      checklist.injuries;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiresQuarantine,
    };
  }

  /**
   * Validates transit state progression
   */
  public static isValidTransitStatusTransition(
    current: TransitStatus,
    target: TransitStatus
  ): boolean {
    const allowed: Record<TransitStatus, TransitStatus[]> = {
      scheduled: ["dispatched", "cancelled"],
      dispatched: ["in_transit", "arrived", "cancelled"],
      in_transit: ["arrived", "cancelled"],
      arrived: ["inspected", "completed", "cancelled"],
      inspected: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    return allowed[current]?.includes(target) ?? false;
  }

  /**
   * Computes per-head logistics cost allocation
   */
  public static computePerHeadLogisticsCost(
    totalTransportCost: number,
    animalCount: number
  ): number {
    if (animalCount <= 0 || totalTransportCost <= 0) return 0;
    return Math.round((totalTransportCost / animalCount) * 100) / 100;
  }
}
