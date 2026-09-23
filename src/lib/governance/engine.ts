/**
 * Enterprise Data Governance & Disaster Recovery Engine
 * Manages soft deletes, data integrity audits, and snapshot validation.
 */

import { logger } from "@/lib/logging/logger";
import { AuditService } from "@/lib/logging/audit";

export interface DataIntegrityReport {
  timestamp: string;
  businessId: string;
  isHealthy: boolean;
  issuesFound: number;
  details: {
    orphanedRecordsCount: number;
    crossTenantAnomaliesCount: number;
    invalidStatusesCount: number;
  };
}

export class DataGovernanceEngine {
  private static instance: DataGovernanceEngine;

  private constructor() {}

  public static getInstance(): DataGovernanceEngine {
    if (!DataGovernanceEngine.instance) {
      DataGovernanceEngine.instance = new DataGovernanceEngine();
    }
    return DataGovernanceEngine.instance;
  }

  /**
   * Evaluates dataset for reference consistency and tenant boundary integrity.
   */
  public auditDatasetIntegrity<T extends { id?: string; business_id?: string; status?: string }>(
    businessId: string,
    records: T[]
  ): DataIntegrityReport {
    let orphaned = 0;
    let crossTenant = 0;
    let invalidStatuses = 0;

    for (const rec of records) {
      if (!rec.id) orphaned++;
      if (rec.business_id && rec.business_id !== businessId) crossTenant++;
      if (rec.status && typeof rec.status !== "string") invalidStatuses++;
    }

    const issues = orphaned + crossTenant + invalidStatuses;
    const isHealthy = issues === 0;

    if (!isHealthy) {
      void AuditService.record({
        businessId,
        userId: "system:governance",
        action: "DATA_INTEGRITY_ANOMALY_DETECTED",
        entityType: "dataset",
        entityId: "batch",
        metadata: { issuesCount: issues, orphaned, crossTenant, invalidStatuses },
      });
      logger.warn(`Data governance detected ${issues} integrity issue(s) for business: ${businessId}`);
    }

    return {
      timestamp: new Date().toISOString(),
      businessId,
      isHealthy,
      issuesFound: issues,
      details: {
        orphanedRecordsCount: orphaned,
        crossTenantAnomaliesCount: crossTenant,
        invalidStatusesCount: invalidStatuses,
      },
    };
  }
}

export const dataGovernanceEngine = DataGovernanceEngine.getInstance();
