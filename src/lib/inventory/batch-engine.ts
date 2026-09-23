import type { BatchLayer } from "./types";
import { BatchExpiredError, InvalidBatchError } from "./errors";

export interface BatchMetadata {
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  supplierName?: string;
  notes?: string;
}

/**
 * Enterprise Batch & Lot Management Engine
 * Parses, tracks, and validates inventory batches and expiry cycles.
 */
export class BatchEngine {
  /**
   * Extracts structured batch metadata from transaction notes memo.
   */
  public static parseBatchFromNotes(notes?: string | null): BatchMetadata {
    if (!notes) return {};

    const meta: BatchMetadata = {};

    const supplierMatch = notes.match(/Supplier:\s*([^.|]+)/i);
    if (supplierMatch) meta.supplierName = supplierMatch[1].trim();

    const batchMatch = notes.match(/Batch:\s*([^.|]+)/i);
    if (batchMatch) meta.batchNumber = batchMatch[1].trim();

    const expMatch = notes.match(/Exp:\s*([^.|]+)/i);
    if (expMatch) meta.expiryDate = expMatch[1].trim();

    const mfgMatch = notes.match(/Mfg:\s*([^.|]+)/i);
    if (mfgMatch) meta.manufacturingDate = mfgMatch[1].trim();

    return meta;
  }

  /**
   * Verifies that a batch is not expired for consumption.
   */
  public static validateBatchExpiry(
    batchNumber: string,
    expiryDate: string | undefined,
    currentDate = new Date().toISOString().slice(0, 10)
  ): void {
    if (!expiryDate) return;
    if (expiryDate < currentDate) {
      throw new BatchExpiredError(batchNumber, expiryDate);
    }
  }

  /**
   * Generates a standard internal batch code for produced mixed feeds or new purchases.
   */
  public static generateBatchCode(prefix = "BATCH", date = new Date()): string {
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ymd}-${rand}`;
  }
}