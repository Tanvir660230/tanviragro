import { AppError, type ErrorCode } from "@/lib/errors/app-error";

export class FinancialError extends AppError {
  constructor(message: string, code: ErrorCode = "BUSINESS_RULE_VIOLATION", statusCode = 400, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class InsufficientCashError extends FinancialError {
  constructor(required: number, available: number) {
    super(
      `Insufficient cash balance: required ${required}, available ${available}`,
      "BUSINESS_RULE_VIOLATION",
      400
    );
  }
}

export class PeriodClosedError extends FinancialError {
  constructor(lockDate: string, transactionDate: string) {
    super(
      `Financial period is closed up to ${lockDate}. Cannot modify transactions on or before this date (${transactionDate}).`,
      "FINANCIAL_PERIOD_LOCKED",
      423
    );
  }
}

export class JournalImbalanceError extends FinancialError {
  constructor(totalDebit: number, totalCredit: number) {
    super(
      `Journal entry is out of balance: total debits (${totalDebit}) must equal total credits (${totalCredit}).`,
      "BUSINESS_RULE_VIOLATION",
      422
    );
  }
}

export class InvalidAccountError extends FinancialError {
  constructor(accountCode: string) {
    super(`Invalid or undefined account code: ${accountCode}`, "VALIDATION_ERROR", 400);
  }
}

export class InvalidAmountError extends FinancialError {
  constructor(fieldName = "Amount") {
    super(`${fieldName} must be a positive finite number.`, "VALIDATION_ERROR", 400);
  }
}