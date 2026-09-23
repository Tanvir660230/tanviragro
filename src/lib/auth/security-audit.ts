import { Permission, ExtendedUserRole, ROLE_PERMISSIONS, ROLE_HIERARCHY } from "@/constants/roles";
import { BusinessContext } from "@/types/context";
import { hasPermission, hasAllPermissions, hasAnyPermission, hasRole, hasMinimumRole } from "./permissions";
import { AuditService } from "../logging/audit";

export interface SecurityAuditResult {
  tenantId: string;
  checkedAt: string;
  isCompliant: boolean;
  violations: SecurityViolation[];
  passedChecks: number;
  totalChecks: number;
}

export interface SecurityViolation {
  code: "TENANT_LEAK" | "UNAUTHORIZED_PERMISSION" | "ROLE_MISMATCH" | "TAMPERED_RESOURCE";
  severity: "critical" | "high" | "medium";
  description: string;
  entityType?: string;
  entityId?: string;
}

export class SecurityAuditEngine {
  private static instance: SecurityAuditEngine;

  private constructor() {}

  public static getInstance(): SecurityAuditEngine {
    if (!SecurityAuditEngine.instance) {
      SecurityAuditEngine.instance = new SecurityAuditEngine();
    }
    return SecurityAuditEngine.instance;
  }

  /**
   * Evaluates tenant boundary constraints on query results or state objects.
   * Ensures that no foreign tenant records leak into the active tenant's context.
   */
  public auditTenantIsolation<T extends { business_id?: string; businessId?: string }>(
    expectedBusinessId: string,
    records: T[],
    entityType: string
  ): SecurityAuditResult {
    const violations: SecurityViolation[] = [];
    let passed = 0;

    for (const record of records) {
      const recordBizId = record.business_id || record.businessId;
      if (recordBizId && recordBizId !== expectedBusinessId) {
        violations.push({
          code: "TENANT_LEAK",
          severity: "critical",
          description: `Cross-tenant leakage detected on ${entityType}: record belongs to ${recordBizId}, expected ${expectedBusinessId}`,
          entityType,
        });
      } else {
        passed++;
      }
    }

    const isCompliant = violations.length === 0;

    if (!isCompliant) {
      void AuditService.record({
        businessId: expectedBusinessId,
        userId: "security-audit-engine",
        action: "TENANT_ISOLATION_VIOLATION",
        entityType,
        entityId: "batch",
        metadata: { violationsCount: violations.length },
      });
    }

    return {
      tenantId: expectedBusinessId,
      checkedAt: new Date().toISOString(),
      isCompliant,
      violations,
      passedChecks: passed,
      totalChecks: records.length,
    };
  }

  /**
   * Verifies that the resolved context has explicit permissions consistent with its assigned role.
   */
  public verifyRbacIntegrity(ctx: BusinessContext): boolean {
    if (ctx.isOwner) return true;

    const assignedRole = ctx.role;
    const standardPerms = ROLE_PERMISSIONS[assignedRole] || [];

    // Context permissions must cover all mandatory role permissions
    for (const p of standardPerms) {
      if (!ctx.permissions.includes(p)) {
        return false;
      }
    }
    return true;
  }
}

export const securityAuditEngine = SecurityAuditEngine.getInstance();
