import type { JournalEntry, JournalPostingLine, FinancialPeriodLock } from "./types";
import { PeriodClosedError, InsufficientCashError } from "./errors";
import { JournalEngine } from "./journal";

export class FinancialControlEngine {
  /**
   * Validates that a transaction date is not inside an active locked accounting period.
   */
  public static validatePeriodNotLocked(
    transactionDate: string,
    periodLocks: FinancialPeriodLock[]
  ): void {
    const txDate = new Date(transactionDate).getTime();

    for (const lock of periodLocks) {
      if (!lock.isLocked) continue;
      const start = new Date(lock.startDate).getTime();
      const end = new Date(lock.endDate).getTime();

      if (txDate >= start && txDate <= end) {
        throw new PeriodClosedError(lock.lockName || `${lock.startDate} to ${lock.endDate}`, transactionDate);
      }
    }
  }

  /**
   * Generates a deterministic idempotency fingerprint to prevent duplicate transactions.
   */
  public static generateTransactionFingerprint(params: {
    businessId: string;
    amount: number;
    transactionDate: string;
    accountCode: string;
    referenceOrNotes?: string;
  }): string {
    const normalizedRef = (params.referenceOrNotes || "").trim().toLowerCase().replace(/\s+/g, "-");
    const normalizedAmount = Math.round(Number(params.amount) * 100);
    return `fp-${params.businessId}-${params.transactionDate}-${params.accountCode}-${normalizedAmount}-${normalizedRef}`;
  }

  /**
   * Prevents overdraft / negative cash balance on cash disbursements.
   */
  public static validateSufficientCashBalance(
    disbursementAmount: number,
    currentCashBalance: number,
    allowOverdraft = false
  ): void {
    if (allowOverdraft) return;
    if (disbursementAmount > currentCashBalance) {
      throw new InsufficientCashError(disbursementAmount, currentCashBalance);
    }
  }

  /**
   * Generates a Storno / Reversal Journal Entry for an existing posted journal.
   * Debits become Credits and Credits become Debits, creating net zero accounting impact.
   */
  public static createReversalJournalEntry(params: {
    businessId: string;
    originalJournal: JournalEntry;
    reversalReason: string;
    reversedBy?: string;
  }): {
    reversalJournal: JournalEntry;
    auditLog: {
      originalId: string;
      reversalId: string;
      reason: string;
      date: string;
    };
  } {
    const orig = params.originalJournal;
    const timestamp = Date.now();
    const reversalId = `je-rev-${timestamp}-${orig.id.slice(-6)}`;
    const reversalRef = `REV-${orig.referenceNumber}`;
    const today = new Date().toISOString().slice(0, 10);

    const reversedLines: JournalPostingLine[] = orig.lines.map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: line.credit, // Invert
      credit: line.debit, // Invert
      notes: `Reversal of [${line.accountCode}] (${params.reversalReason}): ${line.notes || ""}`,
    }));

    const reversalJournal = JournalEngine.validateJournalEntry({
      id: reversalId,
      businessId: params.businessId,
      referenceNumber: reversalRef,
      sourceModule: "manual_journal",
      sourceEntityId: orig.id,
      transactionDate: today,
      description: `REVERSAL of ${orig.referenceNumber} - Reason: ${params.reversalReason}`,
      lines: reversedLines,
      createdBy: params.reversedBy,
      createdAt: new Date().toISOString(),
      metadata: {
        isReversal: true,
        reversalOf: orig.id,
        reversalReason: params.reversalReason,
      },
    });

    return {
      reversalJournal,
      auditLog: {
        originalId: orig.id,
        reversalId: reversalJournal.id,
        reason: params.reversalReason,
        date: today,
      },
    };
  }
}
