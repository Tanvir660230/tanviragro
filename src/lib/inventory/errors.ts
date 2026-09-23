import { AppError, type ErrorCode } from "@/lib/errors/app-error";

export class InventoryError extends AppError {
  constructor(message: string, code: ErrorCode = "BUSINESS_RULE_VIOLATION", statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(itemName: string, required: number, available: number, unit = "unit") {
    super(
      `Insufficient stock for "${itemName}": requested ${required} ${unit}, but only ${available} ${unit} available on hand.`,
      "INSUFFICIENT_STOCK",
      400,
      { itemName, required, available, unit }
    );
  }
}

export class NegativeStockError extends InventoryError {
  constructor(itemName: string, attemptedBalance: number) {
    super(
      `Operation rejected: stock for "${itemName}" cannot become negative (${attemptedBalance}).`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { itemName, attemptedBalance }
    );
  }
}

export class ItemArchivedError extends InventoryError {
  constructor(itemName: string) {
    super(
      `Item "${itemName}" is archived or discontinued and cannot accept new transactions.`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { itemName }
    );
  }
}

export class UnitConversionError extends InventoryError {
  constructor(fromUnit: string, toUnit: string, reason?: string) {
    super(
      `Cannot convert from "${fromUnit}" to "${toUnit}"${reason ? `: ${reason}` : "."}`,
      "VALIDATION_ERROR",
      400,
      { fromUnit, toUnit, reason }
    );
  }
}

export class InvalidBatchError extends InventoryError {
  constructor(batchNumber: string, reason?: string) {
    super(
      `Invalid batch "${batchNumber}"${reason ? `: ${reason}` : "."}`,
      "VALIDATION_ERROR",
      400,
      { batchNumber, reason }
    );
  }
}

export class BatchExpiredError extends InventoryError {
  constructor(batchNumber: string, expiryDate: string) {
    super(
      `Batch "${batchNumber}" expired on ${expiryDate} and cannot be issued.`,
      "BUSINESS_RULE_VIOLATION",
      400,
      { batchNumber, expiryDate }
    );
  }
}

export class ReservationConflictError extends InventoryError {
  constructor(itemName: string, requested: number, freeStock: number) {
    super(
      `Cannot reserve ${requested} of "${itemName}": only ${freeStock} unreserved stock available.`,
      "CONFLICT",
      409,
      { itemName, requested, freeStock }
    );
  }
}

export class CostCalculationError extends InventoryError {
  constructor(message: string) {
    super(`Cost calculation failed: ${message}`, "INTERNAL_ERROR", 500);
  }
}