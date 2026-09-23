/**
 * Tanvir Agro ERP — Workflow Engine Types
 * Definitions for rule-based automation, condition operators, multi-channel actions,
 * retry strategies, observability metrics, and execution audit trails.
 */

import { DomainEvent, DomainEventType, EventPriority } from "../events/types";

export type WorkflowStatus = "active" | "paused" | "disabled" | "draft";

export type ConditionOperator = 
  | "eq" 
  | "neq" 
  | "gt" 
  | "gte" 
  | "lt" 
  | "lte" 
  | "contains" 
  | "not_contains"
  | "in" 
  | "not_in"
  | "is_true"
  | "is_false"
  | "custom";

export interface WorkflowCondition {
  id: string;
  field: string; // e.g. "currentStock", "isOverdue", "changeKg", "daysUntilDue"
  operator: ConditionOperator;
  value?: unknown;
  customEvaluator?: (event: DomainEvent, context?: Record<string, unknown>) => boolean;
}

export type ActionType = 
  | "send_in_app"
  | "send_push"
  | "send_whatsapp"
  | "send_email"
  | "send_webhook"
  | "log_audit"
  | "custom";

export interface DeliveryTarget {
  userId?: string;
  role?: "owner" | "manager" | "worker";
  phone?: string;
  email?: string;
  webhookUrl?: string;
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  target?: DeliveryTarget;
  titleTemplate?: string;
  bodyTemplate?: string;
  priority?: EventPriority;
  actionUrlTemplate?: string;
  retryConfig?: {
    maxAttempts: number;
    initialBackoffMs: number;
    backoffMultiplier: number;
  };
  customExecutor?: (event: DomainEvent, context?: Record<string, unknown>) => Promise<boolean>;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  eventTypes: DomainEventType[];
  priority: EventPriority;
  status: WorkflowStatus;
  conditions: WorkflowCondition[];
  conditionLogic?: "AND" | "OR";
  actions: WorkflowAction[];
  tags?: string[];
  cooldownSeconds?: number; // Prevent duplicate rapid firing
  createdAt: string;
  updatedAt: string;
}

export type ExecutionStatus = "success" | "partial_failure" | "failed" | "skipped";

export interface ActionResultLog {
  actionId: string;
  actionType: ActionType;
  success: boolean;
  attempts: number;
  error?: string;
  durationMs: number;
}

export interface WorkflowExecutionLog {
  executionId: string;
  ruleId: string;
  ruleName: string;
  eventId: string;
  eventType: DomainEventType;
  businessId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: ExecutionStatus;
  conditionsEvaluated: number;
  conditionsPassed: boolean;
  actionLogs: ActionResultLog[];
  errorMessage?: string;
}

export interface WorkflowEngineMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedExecutions: number;
  avgDurationMs: number;
  lastExecutionTime?: string;
}
