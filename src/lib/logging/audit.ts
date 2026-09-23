import { logger } from "./logger";

export interface AuditRecord {
  businessId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: "info" | "warn" | "critical";
}

export class AuditService {
  /**
   * Records a security/compliance audit trail entry.
   * Persists to DB via log_audit RPC; falls back to structured console logging.
   */
  public static async record(record: AuditRecord): Promise<void> {
    // Always log structured for observability
    logger.info(`[AUDIT] ${record.action} on ${record.entityType}:${record.entityId}`, {
      module: "audit",
      businessId: record.businessId,
      userId: record.userId,
      entityType: record.entityType,
      entityId: record.entityId,
      severity: record.severity ?? "info",
    });

    // Persist to DB non-blocking best-effort
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await (supabase as any).rpc("log_audit", {
        p_business_id: record.businessId,
        p_user_id: record.userId,
        p_action: record.action,
        p_entity_type: record.entityType,
        p_entity_id: record.entityId,
        p_old_value: record.oldValue ?? null,
        p_new_value: record.newValue ?? null,
        p_metadata: record.metadata ?? null,
        p_ip_address: record.ipAddress ?? null,
        p_user_agent: record.userAgent ?? null,
        p_severity: record.severity ?? "info",
      });
    } catch (err: unknown) {
      logger.warn("Audit DB write failed — console record retained", {
        action: record.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Records a critical-severity security audit event.
   */
  public static async recordCritical(record: Omit<AuditRecord, "severity">): Promise<void> {
    return AuditService.record({ ...record, severity: "critical" });
  }
}
