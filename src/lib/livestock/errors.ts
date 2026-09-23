import { AppError } from "@/lib/errors/app-error";

export class InvalidStatusTransitionError extends AppError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Invalid livestock status transition from '${fromStatus}' to '${toStatus}'`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { fromStatus, toStatus }
    );
  }
}

export class WithdrawalPeriodActiveError extends AppError {
  constructor(cattleTag: string, withdrawalUntil: string) {
    super(
      `Animal ${cattleTag} is under active drug withdrawal until ${withdrawalUntil}. Meat/milk cannot be sold.`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { cattleTag, withdrawalUntil }
    );
  }
}

export class InvalidWeightLogError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class GestationPeriodError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "BUSINESS_RULE_VIOLATION", 400, details);
  }
}

export class UnauthorizedLifecycleTransitionError extends AppError {
  constructor(role: string, targetStatus: string) {
    super(
      `Role '${role}' is not authorized to transition animal to status '${targetStatus}'`,
      "FORBIDDEN",
      403,
      { role, targetStatus }
    );
  }
}

export class BreedingAgeViolationError extends AppError {
  constructor(tagId: string, ageInMonths: number, minAgeMonths: number) {
    super(
      `Animal #${tagId} is ${ageInMonths.toFixed(1)} months old, which is below the minimum breeding threshold of ${minAgeMonths} months.`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { tagId, ageInMonths, minAgeMonths }
    );
  }
}

export class LifecycleBusinessRuleError extends AppError {
  constructor(ruleName: string, reason: string, details?: unknown) {
    super(`Lifecycle rule violation [${ruleName}]: ${reason}`, "BUSINESS_RULE_VIOLATION", 400, {
      ruleName,
      reason,
      details,
    });
  }
}

export class LifecycleDateSanityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class InvalidVitalSignsError extends AppError {
  constructor(field: string, value: number, expectedRange: string) {
    super(
      `Invalid vital sign for ${field}: ${value}. Expected physiological range: ${expectedRange}`,
      "VALIDATION_ERROR",
      400,
      { field, value, expectedRange }
    );
  }
}

export class InsufficientMedicineStockError extends AppError {
  constructor(medicineName: string, requested: number, available: number, unit: string) {
    super(
      `Insufficient inventory for medicine '${medicineName}'. Requested: ${requested} ${unit}, available stock: ${available} ${unit}`,
      "INSUFFICIENT_STOCK",
      400,
      { medicineName, requested, available, unit }
    );
  }
}

export class PrescriptionDosageError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnauthorizedMedicalActionError extends AppError {
  constructor(action: string, role: string) {
    super(
      `User with role '${role}' is not authorized to execute medical action: ${action}`,
      "FORBIDDEN",
      403,
      { action, role }
    );
  }
}
