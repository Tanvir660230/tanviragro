/**
 * Tanvir Agro ERP — Phase 3.3: Backup Manifest Generator & Verifier
 *
 * Produces a portable, checksummed manifest of a backup dataset so that
 * backups can be verified for completeness and integrity (restore dry-run).
 *
 * SAFETY: Both functions are purely computational — no network, no DB
 * writes, no file-system mutation. They operate on data already in memory.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface TableBackupManifest {
  /** Canonical table name, e.g. "cattle". */
  table: string;
  /** Number of rows captured in the backup. */
  rowCount: number;
  /**
   * Stable SHA-256 hex digest over empty-string-joined row passages.
   * Sensitive fields (passwords, tokens) MUST already be redacted upstream.
   */
  checksum: string;
}

export interface BackupManifest {
  businessId: string;
  generatedAt: string;
  schemaVersion: 1;
  tables: TableBackupManifest[];
  overallChecksum: string;
}

export interface TableVerificationResult {
  table: string;
  passed: boolean;
  expectedRowCount: number;
  actualRowCount: number;
  expectedChecksum: string;
  actualChecksum: string;
  mismatchReason: "row_count" | "checksum" | "ok";
}

export interface BackupVerificationResult {
  manifestBusinessId: string;
  verifiedAt: string;
  allPassed: boolean;
  tables: TableVerificationResult[];
}

// ── Hashing helper (Node crypto, no external dependency) ──────────

import { createHash } from "crypto";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Deterministic digest for a list of rows. Insensitive to key order within
 * a row (keys are sorted) but sensitive to every value, so any data drift
 * between backup and restore produces a different checksum.
 */
export function computeTableChecksum(rows: Record<string, unknown>[]): string {
  const passages = rows.map((row) => {
    const sortedKeys = Object.keys(row).sort();
    return sortedKeys.map((k) => `${k}=${JSON.stringify(row[k]) ?? "null"}`).join("|");
  });
  return sha256Hex(passages.join("\n"));
}

/**
 * Builds a manifest for a backup dataset. Order is fixed and deterministic
 * (tables sorted by name) so re-running over identical data is idempotent.
 */
export function generateBackupManifest(
  businessId: string,
  tables: Record<string, Record<string, unknown>[]>
): BackupManifest {
  const tableNames = Object.keys(tables).sort();
  const tableManifests: TableBackupManifest[] = tableNames.map((table) => {
    const rows = tables[table] ?? [];
    return {
      table,
      rowCount: rows.length,
      checksum: computeTableChecksum(rows),
    };
  });

  const overallChecksum = sha256Hex(
    tableManifests.map((t) => `${t.table}:${t.rowCount}:${t.checksum}`).join("\n")
  );

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    tables: tableManifests,
    overallChecksum,
  };
}

/**
 * Verifies a candidate restore dataset against an earlier manifest.
 * Total count of any row mismatch or checksum mismatch makes the table (and
 * overall result) fail.
 */
export function verifyBackup(
  manifest: BackupManifest,
  candidate: Record<string, Record<string, unknown>[]>
): BackupVerificationResult {
  const tableResults: TableVerificationResult[] = manifest.tables.map((expected) => {
    const rows = candidate[expected.table] ?? [];
    const actualRowCount = rows.length;
    const actualChecksum = computeTableChecksum(rows);

    const rowCountOk = actualRowCount === expected.rowCount;
    const checksumOk = actualChecksum === expected.checksum;

    return {
      table: expected.table,
      passed: rowCountOk && checksumOk,
      expectedRowCount: expected.rowCount,
      actualRowCount,
      expectedChecksum: expected.checksum,
      actualChecksum,
      mismatchReason: rowCountOk ? (checksumOk ? "ok" : "checksum") : "row_count",
    };
  });

  return {
    manifestBusinessId: manifest.businessId,
    verifiedAt: new Date().toISOString(),
    allPassed: tableResults.every((r) => r.passed),
    tables: tableResults,
  };
}