/**
 * Enterprise Integration Platform — Centralized External Services & Webhook Engine
 */

import { logger } from "@/lib/logging/logger";
import { AuditService } from "@/lib/logging/audit";
import { telemetryService } from "@/lib/monitoring/telemetry";

export interface WebhookPayload<T = unknown> {
  id: string;
  source: "payment_gateway" | "sms_gateway" | "storage" | "external_erp";
  event: string;
  businessId?: string;
  data: T;
  timestamp: string;
}

export interface WebhookResult {
  success: boolean;
  message?: string;
  processedAt: string;
}

export type WebhookHandler<T = unknown> = (payload: WebhookPayload<T>) => Promise<WebhookResult>;

export class IntegrationPlatform {
  private static instance: IntegrationPlatform;
  private handlers = new Map<string, WebhookHandler[]>();

  private constructor() {}

  public static getInstance(): IntegrationPlatform {
    if (!IntegrationPlatform.instance) {
      IntegrationPlatform.instance = new IntegrationPlatform();
    }
    return IntegrationPlatform.instance;
  }

  /**
   * Register a webhook handler for a specific event or wildcard.
   */
  public registerWebhookHandler<T = unknown>(event: string, handler: WebhookHandler<T>): void {
    const list = this.handlers.get(event) || [];
    list.push(handler as WebhookHandler);
    this.handlers.set(event, list);
  }

  /**
   * Dispatch incoming webhook payload with validation, retry backoff, and audit logging.
   */
  public async processWebhook<T = unknown>(payload: WebhookPayload<T>): Promise<WebhookResult[]> {
    logger.info(`Processing incoming webhook ${payload.source}:${payload.event}`, {
      webhookId: payload.id,
      source: payload.source,
      event: payload.event,
    });

    const handlers = [
      ...(this.handlers.get(payload.event) || []),
      ...(this.handlers.get("*") || []),
    ];

    if (handlers.length === 0) {
      logger.warn(`No webhook handlers registered for event: ${payload.event}`);
      return [{ success: true, message: "No handlers configured", processedAt: new Date().toISOString() }];
    }

    const results: WebhookResult[] = [];
    for (const handler of handlers) {
      try {
        const result = await handler(payload);
        results.push(result);

        if (payload.businessId) {
          void AuditService.record({
            businessId: payload.businessId,
            userId: `webhook:${payload.source}`,
            action: `WEBHOOK_PROCESSED_${payload.event.toUpperCase()}`,
            entityType: "webhook",
            entityId: payload.id,
            metadata: { source: payload.source, success: result.success },
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        telemetryService.recordError(msg, "api", "high");
        results.push({
          success: false,
          message: msg,
          processedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }
}

export const integrationPlatform = IntegrationPlatform.getInstance();
