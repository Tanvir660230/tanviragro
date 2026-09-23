/**
 * Tanvir Agro ERP — Enterprise Operations & Monitoring Types
 * Data contracts for observability, health probes, telemetry, error tracking,
 * API monitoring, background jobs, incidents, and audit streaming.
 */

export type ServiceStatus = "healthy" | "degraded" | "down" | "unconfigured" | "unknown";
export type OverallSystemStatus = "OPERATIONAL" | "DEGRADED" | "CRITICAL_OUTAGE" | "MAINTENANCE";

export interface ServiceHealthResult {
  serviceKey: string;
  serviceName: string;
  category: "database" | "storage" | "auth" | "notifications" | "engine" | "external" | "client";
  status: ServiceStatus;
  latencyMs: number;
  message: string;
  lastChecked: string;
  details?: Record<string, unknown>;
}

export interface SystemResourceMetrics {
  uptimeSeconds: number;
  nodeVersion: string;
  environment: string;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
  };
  timestamp: string;
  platform: string;
}

export interface EndpointProbe {
  endpoint: string;
  name: string;
  method: "GET" | "POST" | "HEAD";
  category: "cron" | "auth" | "notification" | "qr" | "system";
  expectedStatus: number;
  lastStatus?: number;
  latencyMs?: number;
  status: ServiceStatus;
  lastTested?: string;
  isExternal?: boolean;
}

export interface ErrorLogEntry {
  id: string;
  signature: string;
  message: string;
  module: "cattle" | "inventory" | "finance" | "accounting" | "auth" | "workflow" | "api" | "storage" | "database" | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  count: number;
  firstSeen: string;
  lastSeen: string;
  stackTrace?: string;
  userContext?: {
    userId?: string;
    role?: string;
    businessId?: string;
  };
  status: "active" | "acknowledged" | "resolved" | "ignored";
  sanitized: boolean;
}

export interface SystemHealthSummary {
  overallStatus: OverallSystemStatus;
  services: ServiceHealthResult[];
  endpoints: EndpointProbe[];
  jobs: BackgroundJobStatus[];
  timestamp: string;
}

export interface PerformanceMetric {
  id: string;
  type: "page_load" | "navigation" | "server_action" | "api_latency" | "hydration" | "query";
  name: string;
  durationMs: number;
  timestamp: string;
  status: "fast" | "acceptable" | "slow" | "critical";
  metadata?: Record<string, unknown>;
}

export interface IncidentRecord {
  id: string;
  title: string;
  severity: "critical" | "major" | "minor";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impactedServices: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  summary: string;
  timeline: {
    timestamp: string;
    message: string;
    actor?: string;
  }[];
}

export interface OperationalLogItem {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  module: string;
  message: string;
  metadata?: Record<string, unknown>;
  actor?: string;
}

export type TelemetryLogEntry = OperationalLogItem;

export interface BackgroundJobStatus {
  id: string;
  name: string;
  type: "cron" | "workflow" | "offline_sync" | "backup";
  schedule?: string;
  lastRun?: string;
  nextRun?: string;
  status: "idle" | "running" | "success" | "failed" | "skipped";
  durationMs?: number;
  itemsProcessed?: number;
  error?: string;
}
