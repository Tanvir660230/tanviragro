/**
 * Enterprise Snapshot & Audit Diff Verifier
 * Calculates immutable property diffs, state checksums, and audit integrity verification.
 */

export interface FieldDiff {
  field: string;
  previousValue: unknown;
  currentValue: unknown;
}

export interface StateSnapshotAudit {
  entityType: string;
  entityId: string;
  timestamp: string;
  hasChanges: boolean;
  diffs: FieldDiff[];
  checksum: string;
}

export class SnapshotVerifier {
  /**
   * Generates a stable deterministic hash/checksum for any JSON-serializable state
   */
  public static computeChecksum(state: unknown): string {
    const serialized = JSON.stringify(state, Object.keys(state && typeof state === "object" ? state : {}).sort());
    let hash = 0;
    for (let i = 0; i < (serialized?.length || 0); i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  /**
   * Computes shallow & deep property differences between previous and current state
   */
  public static computeDiff(
    previousState: Record<string, unknown> | null | undefined,
    currentState: Record<string, unknown> | null | undefined,
    ignoredKeys: string[] = ["updated_at", "updatedAt"]
  ): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    const prev = previousState || {};
    const curr = currentState || {};

    const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)]));

    for (const key of allKeys) {
      if (ignoredKeys.includes(key)) continue;

      const val1 = prev[key];
      const val2 = curr[key];

      const val1Str = JSON.stringify(val1);
      const val2Str = JSON.stringify(val2);

      if (val1Str !== val2Str) {
        diffs.push({
          field: key,
          previousValue: val1,
          currentValue: val2,
        });
      }
    }

    return diffs;
  }

  /**
   * Builds an audit-ready snapshot object with diffs and checksum validation
   */
  public static createAuditSnapshot(
    entityType: string,
    entityId: string,
    previousState: Record<string, unknown> | null | undefined,
    currentState: Record<string, unknown> | null | undefined
  ): StateSnapshotAudit {
    const diffs = this.computeDiff(previousState, currentState);
    const checksum = this.computeChecksum(currentState);

    return {
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      hasChanges: diffs.length > 0,
      diffs,
      checksum,
    };
  }
}
