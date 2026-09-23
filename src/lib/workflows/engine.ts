/**
 * Tanvir Agro ERP — Enterprise Workflow Automation Engine
 * Evaluates triggers, conditions, actions, retry backoff, observability metrics, and execution history.
 */

import { DomainEvent } from "../events/types";
import { eventBus } from "../events/event-bus";
import { deliveryService, DeliveryMessage } from "../delivery/channels";
import {
  WorkflowRule,
  WorkflowCondition,
  WorkflowAction,
  WorkflowExecutionLog,
  ActionResultLog,
  WorkflowEngineMetrics,
  ExecutionStatus,
} from "./types";

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private rules: Map<string, WorkflowRule> = new Map();
  private executionLogs: WorkflowExecutionLog[] = [];
  private maxLogs = 200;
  private lastFiredMap: Map<string, number> = new Map();

  private constructor() {
    // Automatically bind to event bus
    eventBus.subscribe("*", async (event) => {
      await this.handleDomainEvent(event);
    });
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  public registerRule(rule: WorkflowRule): void {
    this.rules.set(rule.id, rule);
  }

  public registerRules(rules: WorkflowRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  public unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public getRules(): WorkflowRule[] {
    return Array.from(this.rules.values());
  }

  public async executeRule(rule: WorkflowRule, event: DomainEvent): Promise<WorkflowExecutionLog> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (rule.cooldownSeconds && rule.cooldownSeconds > 0) {
      const cooldownKey = `${rule.id}_${event.businessId}_${(event as any).cattleId || (event as any).itemId || "global"}`;
      const lastFired = this.lastFiredMap.get(cooldownKey) || 0;
      const elapsedSeconds = (Date.now() - lastFired) / 1000;
      if (elapsedSeconds < rule.cooldownSeconds) {
        const skippedLog: WorkflowExecutionLog = {
          executionId,
          ruleId: rule.id,
          ruleName: rule.name,
          eventId: event.eventId,
          eventType: event.eventType,
          businessId: event.businessId,
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          status: "skipped",
          conditionsEvaluated: 0,
          conditionsPassed: false,
          actionLogs: [],
          errorMessage: `Cooldown active (${Math.round(rule.cooldownSeconds - elapsedSeconds)}s remaining)`,
        };
        this.recordLog(skippedLog);
        return skippedLog;
      }
      this.lastFiredMap.set(cooldownKey, Date.now());
    }

    const conditionsPassed = this.evaluateConditions(rule.conditions, rule.conditionLogic ?? "AND", event);
    if (!conditionsPassed) {
      const skippedLog: WorkflowExecutionLog = {
        executionId,
        ruleId: rule.id,
        ruleName: rule.name,
        eventId: event.eventId,
        eventType: event.eventType,
        businessId: event.businessId,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        status: "skipped",
        conditionsEvaluated: rule.conditions.length,
        conditionsPassed: false,
        actionLogs: [],
      };
      this.recordLog(skippedLog);
      return skippedLog;
    }

    const actionLogs: ActionResultLog[] = [];
    let hasFailures = false;
    let hasSuccesses = false;

    for (const action of rule.actions) {
      const actionResult = await this.executeActionWithRetry(action, event, rule);
      actionLogs.push(actionResult);
      if (actionResult.success) hasSuccesses = true;
      else hasFailures = true;
    }

    let status: ExecutionStatus = "success";
    if (hasFailures && !hasSuccesses) status = "failed";
    else if (hasFailures && hasSuccesses) status = "partial_failure";

    const log: WorkflowExecutionLog = {
      executionId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.eventId,
      eventType: event.eventType,
      businessId: event.businessId,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status,
      conditionsEvaluated: rule.conditions.length,
      conditionsPassed: true,
      actionLogs,
    };

    this.recordLog(log);
    return log;
  }

  public async handleDomainEvent(event: DomainEvent): Promise<WorkflowExecutionLog[]> {
    const matchingRules = Array.from(this.rules.values()).filter(
      (rule) => rule.status === "active" && rule.eventTypes.includes(event.eventType)
    );

    const logs: WorkflowExecutionLog[] = [];
    for (const rule of matchingRules) {
      const log = await this.executeRule(rule, event);
      logs.push(log);
    }
    return logs;
  }
  private evaluateConditions(conditions: WorkflowCondition[], logic: "AND" | "OR", event: DomainEvent): boolean {
    if (conditions.length === 0) return true;
    const results = conditions.map((c) => this.evaluateSingleCondition(c, event));
    return logic === "OR" ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateSingleCondition(condition: WorkflowCondition, event: DomainEvent): boolean {
    if (condition.operator === "custom" && condition.customEvaluator) {
      return condition.customEvaluator(event);
    }
    const eventRecord = event as unknown as Record<string, unknown>;
    const metadataRecord = (event.metadata || {}) as Record<string, unknown>;
    const rawVal = eventRecord[condition.field] !== undefined ? eventRecord[condition.field] : metadataRecord[condition.field];

    switch (condition.operator) {
      case "eq": return rawVal === condition.value;
      case "neq": return rawVal !== condition.value;
      case "gt": return Number(rawVal) > Number(condition.value);
      case "gte": return Number(rawVal) >= Number(condition.value);
      case "lt": return Number(rawVal) < Number(condition.value);
      case "lte": return Number(rawVal) <= Number(condition.value);
      case "contains": return typeof rawVal === "string" && rawVal.includes(String(condition.value));
      case "not_contains": return typeof rawVal === "string" && !rawVal.includes(String(condition.value));
      case "in": return Array.isArray(condition.value) && condition.value.includes(rawVal);
      case "not_in": return Array.isArray(condition.value) && !condition.value.includes(rawVal);
      case "is_true": return Boolean(rawVal) === true;
      case "is_false": return Boolean(rawVal) === false;
      default: return true;
    }
  }

  private async executeActionWithRetry(
    action: WorkflowAction,
    event: DomainEvent,
    rule: WorkflowRule
  ): Promise<ActionResultLog> {
    const actionStartTime = Date.now();
    const retry = action.retryConfig || { maxAttempts: 1, initialBackoffMs: 100, backoffMultiplier: 2 };
    let attempt = 0;
    let lastError: string | undefined;

    const title = this.renderTemplate(action.titleTemplate || event.title, event);
    const body = this.renderTemplate(action.bodyTemplate || event.description, event);
    const url = action.actionUrlTemplate ? this.renderTemplate(action.actionUrlTemplate, event) : event.actionUrl;

    const message: DeliveryMessage = {
      title,
      body,
      url,
      priority: action.priority || rule.priority || event.priority,
      target: action.target,
      metadata: event.metadata,
    };

    while (attempt < retry.maxAttempts) {
      attempt++;
      try {
        if (action.type === "custom" && action.customExecutor) {
          const success = await action.customExecutor(event);
          if (success) {
            return { actionId: action.id, actionType: action.type, success: true, attempts: attempt, durationMs: Date.now() - actionStartTime };
          }
          throw new Error("Custom executor returned false");
        }

        const deliveryResult = await deliveryService.deliver(action.type, message);
        if (deliveryResult.success) {
          return { actionId: action.id, actionType: action.type, success: true, attempts: attempt, durationMs: Date.now() - actionStartTime };
        }
        lastError = deliveryResult.error || "Delivery failed";
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (attempt < retry.maxAttempts) {
        const delay = retry.initialBackoffMs * Math.pow(retry.backoffMultiplier, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    return { actionId: action.id, actionType: action.type, success: false, attempts: attempt, error: lastError, durationMs: Date.now() - actionStartTime };
  }

  private renderTemplate(template: string, event: DomainEvent): string {
    const dict = {
      ...(event as unknown as Record<string, unknown>),
      ...((event.metadata || {}) as Record<string, unknown>),
    };
    return template.replace(/\{(\w+)\}/g, (_, key) => dict[key] !== undefined ? String(dict[key]) : `{${key}}`);
  }

  private recordLog(log: WorkflowExecutionLog): void {
    this.executionLogs.unshift(log);
    if (this.executionLogs.length > this.maxLogs) this.executionLogs.pop();
  }

  public getExecutionLogs(limit = 50): WorkflowExecutionLog[] {
    return this.executionLogs.slice(0, limit);
  }

  public getMetrics(): WorkflowEngineMetrics {
    const total = this.executionLogs.length;
    const successful = this.executionLogs.filter((l) => l.status === "success").length;
    const failed = this.executionLogs.filter((l) => l.status === "failed" || l.status === "partial_failure").length;
    const skipped = this.executionLogs.filter((l) => l.status === "skipped").length;
    const totalDuration = this.executionLogs.reduce((acc, l) => acc + l.durationMs, 0);

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      skippedExecutions: skipped,
      avgDurationMs: total > 0 ? Math.round(totalDuration / total) : 0,
      lastExecutionTime: this.executionLogs[0]?.completedAt,
    };
  }
}

export const workflowEngine = WorkflowEngine.getInstance();

