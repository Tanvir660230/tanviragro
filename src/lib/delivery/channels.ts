/**
 * Tanvir Agro ERP — Multi-Channel Delivery Engine
 * Dispatches notifications across In-App, Web Push, WhatsApp/SMS, Email, and Webhook
 * using strictly existing integrations and credentials.
 */

import { sendWhatsAppWithFallback, sendAlertEmail, sendWhatsApp, sendPushToUser } from "@/lib/notifications";
import { ActionType, DeliveryTarget } from "../workflows/types";
import { EventPriority } from "../events/types";

export interface DeliveryMessage {
  title: string;
  body: string;
  url?: string;
  priority?: EventPriority;
  target?: DeliveryTarget;
  metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  channel: ActionType;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export class DeliveryService {
  private static instance: DeliveryService;

  private constructor() {}

  public static getInstance(): DeliveryService {
    if (!DeliveryService.instance) {
      DeliveryService.instance = new DeliveryService();
    }
    return DeliveryService.instance;
  }

  public async deliver(channel: ActionType, message: DeliveryMessage): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      switch (channel) {
        case "send_whatsapp": {
          const formattedMessage = `📢 *${message.title}*\n\n${message.body}${message.url ? `\n\n👉 View: ${message.url}` : ""}`;
          const targetPhone = message.target?.phone;
          
          if (targetPhone) {
            const res = await sendWhatsApp(formattedMessage, targetPhone);
            return {
              channel,
              success: res.sent,
              error: !res.sent ? `WhatsApp failed: ${res.reason}` : undefined,
              latencyMs: Date.now() - startTime,
            };
          } else {
            await sendWhatsAppWithFallback(formattedMessage, message.title);
            return {
              channel,
              success: true,
              latencyMs: Date.now() - startTime,
            };
          }
        }

        case "send_email": {
          const emailBody = `${message.body}\n\n${message.url ? `Action Link: ${message.url}\n\n` : ""}Priority: ${message.priority ?? "normal"}`;
          const emailSubject = `[Tanvir Agro] ${message.title}`;
          const success = await sendAlertEmail(emailSubject, emailBody);
          return {
            channel,
            success,
            error: success ? undefined : "Email dispatch returned false",
            latencyMs: Date.now() - startTime,
          };
        }

        case "send_push": {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
          const userId = message.target?.userId ?? "all";
          await sendPushToUser(
            userId,
            {
              title: message.title,
              body: message.body,
              url: message.url,
              urgent: message.priority === "critical" || message.priority === "high",
            },
            baseUrl
          );
          return {
            channel,
            success: true,
            latencyMs: Date.now() - startTime,
          };
        }

        case "send_webhook": {
          const webhookUrl = message.target?.webhookUrl;
          if (!webhookUrl) {
            return {
              channel,
              success: false,
              error: "No webhook URL provided in target",
              latencyMs: Date.now() - startTime,
            };
          }

          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "TanvirAgro-WorkflowEngine/1.0",
            },
            body: JSON.stringify({
              title: message.title,
              body: message.body,
              url: message.url,
              priority: message.priority,
              metadata: message.metadata,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(5000), // 5-second max timeout
          });

          return {
            channel,
            success: response.ok,
            error: response.ok ? undefined : `Webhook responded with HTTP ${response.status}`,
            latencyMs: Date.now() - startTime,
          };
        }

        case "send_in_app":
        default: {
          // In-App events are recorded into notification feed
          return {
            channel: "send_in_app",
            success: true,
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      return {
        channel,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

export const deliveryService = DeliveryService.getInstance();
