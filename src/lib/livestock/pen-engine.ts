/**
 * Tanvir Agro ERP — Multi-Farm & Pen Operations Engine (Sprint 08)
 */

export type PenType = "fattening" | "quarantine" | "nursery" | "maternity" | "isolation" | "general";
export type PenStatusTier = "available" | "optimal" | "warning" | "full" | "overcapacity";

export interface FarmEntity {
  id: string;
  businessId: string;
  name: string;
  code: string;
  location?: string | null;
  capacity: number;
  isActive: boolean;
}

export interface PenEntity {
  id: string;
  businessId: string;
  farmId: string;
  name: string;
  code: string;
  type: PenType;
  capacity: number;
  currentOccupancy: number;
  notes?: string | null;
  isActive: boolean;
}

export interface PenOccupancyMetrics {
  penId: string;
  capacity: number;
  occupancy: number;
  availableCapacity: number;
  occupancyRatePct: number;
  status: PenStatusTier;
  statusColor: string;
  isOverCapacity: boolean;
  isNearCapacity: boolean;
}

export interface FarmCapacityMetrics {
  farmId: string;
  totalPens: number;
  activePens: number;
  totalCapacity: number;
  totalOccupancy: number;
  availableCapacity: number;
  overallOccupancyPct: number;
  pensNearCapacityCount: number;
  pensOverCapacityCount: number;
  breakdownByType: Record<PenType, { count: number; capacity: number; occupancy: number }>;
}

export interface MovementValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PenEngine {
  public static readonly WARNING_THRESHOLD_PCT = 85;
  public static readonly FULL_THRESHOLD_PCT = 100;

  public static calculatePenOccupancy(
    capacity: number,
    currentOccupancy: number,
    penId: string = ""
  ): PenOccupancyMetrics {
    const validCapacity = Math.max(1, capacity);
    const validOccupancy = Math.max(0, currentOccupancy);
    const occupancyRatePct = (validOccupancy / validCapacity) * 100;
    const availableCapacity = Math.max(0, validCapacity - validOccupancy);

    let status: PenStatusTier = "available";
    let statusColor = "emerald";

    if (occupancyRatePct > this.FULL_THRESHOLD_PCT) {
      status = "overcapacity";
      statusColor = "rose";
    } else if (occupancyRatePct === this.FULL_THRESHOLD_PCT) {
      status = "full";
      statusColor = "amber";
    } else if (occupancyRatePct >= this.WARNING_THRESHOLD_PCT) {
      status = "warning";
      statusColor = "yellow";
    } else if (occupancyRatePct >= 50) {
      status = "optimal";
      statusColor = "blue";
    }

    return {
      penId,
      capacity: validCapacity,
      occupancy: validOccupancy,
      availableCapacity,
      occupancyRatePct: Math.round(occupancyRatePct * 10) / 10,
      status,
      statusColor,
      isOverCapacity: occupancyRatePct > this.FULL_THRESHOLD_PCT,
      isNearCapacity: occupancyRatePct >= this.WARNING_THRESHOLD_PCT && occupancyRatePct <= this.FULL_THRESHOLD_PCT,
    };
  }

  public static calculateFarmCapacity(
    farmId: string,
    pens: PenEntity[]
  ): FarmCapacityMetrics {
    const activePens = pens.filter((p) => p.isActive);
    const totalCapacity = activePens.reduce((sum, p) => sum + (p.capacity || 0), 0);
    const totalOccupancy = activePens.reduce((sum, p) => sum + (p.currentOccupancy || 0), 0);
    const availableCapacity = Math.max(0, totalCapacity - totalOccupancy);
    const overallOccupancyPct = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;

    let pensNearCapacityCount = 0;
    let pensOverCapacityCount = 0;

    const breakdownByType: Record<PenType, { count: number; capacity: number; occupancy: number }> = {
      fattening: { count: 0, capacity: 0, occupancy: 0 },
      quarantine: { count: 0, capacity: 0, occupancy: 0 },
      nursery: { count: 0, capacity: 0, occupancy: 0 },
      maternity: { count: 0, capacity: 0, occupancy: 0 },
      isolation: { count: 0, capacity: 0, occupancy: 0 },
      general: { count: 0, capacity: 0, occupancy: 0 },
    };

    for (const pen of activePens) {
      const type = pen.type || "fattening";
      if (!breakdownByType[type]) {
        breakdownByType[type] = { count: 0, capacity: 0, occupancy: 0 };
      }
      breakdownByType[type].count += 1;
      breakdownByType[type].capacity += pen.capacity;
      breakdownByType[type].occupancy += pen.currentOccupancy;

      const metrics = this.calculatePenOccupancy(pen.capacity, pen.currentOccupancy, pen.id);
      if (metrics.isOverCapacity) pensOverCapacityCount++;
      else if (metrics.isNearCapacity) pensNearCapacityCount++;
    }

    return {
      farmId,
      totalPens: pens.length,
      activePens: activePens.length,
      totalCapacity,
      totalOccupancy,
      availableCapacity,
      overallOccupancyPct: Math.round(overallOccupancyPct * 10) / 10,
      pensNearCapacityCount,
      pensOverCapacityCount,
      breakdownByType,
    };
  }

  public static validateAnimalMovement(
    targetPen: PenEntity,
    animal: {
      tagId: string;
      isQuarantined?: boolean;
      isContagious?: boolean;
    },
    batchSize: number = 1
  ): MovementValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!targetPen.isActive) {
      errors.push(`Target pen "${targetPen.name}" is deactivated.`);
    }

    const availableSpace = targetPen.capacity - targetPen.currentOccupancy;
    if (availableSpace < batchSize) {
      errors.push(`Insufficient capacity in pen "${targetPen.name}" (${targetPen.currentOccupancy}/${targetPen.capacity}).`);
    } else if (availableSpace === batchSize) {
      warnings.push(`Transfer will reach 100% capacity in pen "${targetPen.name}".`);
    }

    if (animal.isContagious && targetPen.type !== "isolation") {
      errors.push(`Biosecurity violation: Animal #${animal.tagId} has contagious condition and must be in isolation pen.`);
    }

    if (animal.isQuarantined && targetPen.type !== "quarantine" && targetPen.type !== "isolation") {
      warnings.push(`Animal #${animal.tagId} is quarantined; target pen is ${targetPen.type}.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
