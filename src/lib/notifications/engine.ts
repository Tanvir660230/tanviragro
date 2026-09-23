import { deliveryService } from "../delivery/channels";
import { NotificationItem, NotificationCategory } from "./types";
import { AlertSeverity } from "../alerts/hierarchy";
import { AuditService } from "../logging/audit";

export interface NotificationTemplate {
  id: string;
  category: NotificationCategory;
  titleTemplate: string;
  bodyTemplate: string;
  defaultSeverity: AlertSeverity;
  defaultIcon: NotificationItem["iconKey"];
  actionUrlTemplate?: string;
}

export interface SendNotificationOptions {
  businessId: string;
  userId?: string;
  title: string;
  body: string;
  category?: NotificationCategory;
  severity?: AlertSeverity;
  iconKey?: NotificationItem["iconKey"];
  url?: string;
  channels?: ("in_app" | "push" | "email" | "whatsapp")[];
  targetPhone?: string;
  metadata?: Record<string, unknown>;
}

export class NotificationEngine {
  private static instance: NotificationEngine;
  private inAppNotifications: Map<string, NotificationItem[]> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();

  private constructor() {
    this.registerDefaultTemplates();
  }

  public static getInstance(): NotificationEngine {
    if (!NotificationEngine.instance) {
      NotificationEngine.instance = new NotificationEngine();
    }
    return NotificationEngine.instance;
  }

  private registerDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: "inventory_low_stock",
        category: "inventory",
        titleTemplate: "Low Stock: {name}",
        bodyTemplate: "Item {name} is low on stock ({stock} {unit} remaining).",
        defaultSeverity: "high",
        defaultIcon: "package",
        actionUrlTemplate: "/dashboard/inventory",
      },
      {
        id: "inventory_out_of_stock",
        category: "inventory",
        titleTemplate: "Out of Stock: {name}",
        bodyTemplate: "Item {name} is completely depleted. Reorder immediately.",
        defaultSeverity: "critical",
        defaultIcon: "package",
        actionUrlTemplate: "/dashboard/inventory",
      },
      {
        id: "health_event_due",
        category: "cattle",
        titleTemplate: "Medical Event Due: #{tag}",
        bodyTemplate: "{title} scheduled for cattle #{tag} on {date}.",
        defaultSeverity: "medium",
        defaultIcon: "heart",
        actionUrlTemplate: "/dashboard/cattle/{cattleId}?tab=health",
      },
    ];

    for (const t of defaultTemplates) {
      this.templates.set(t.id, t);
    }
  }

  public renderTemplate(templateId: string, params: Record<string, unknown>): { title: string; body: string; url?: string } | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    let title = template.titleTemplate;
    let body = template.bodyTemplate;
    let url = template.actionUrlTemplate;

    for (const [key, val] of Object.entries(params)) {
      const ph = new RegExp(`\\{${key}\\}`, "g");
      title = title.replace(ph, String(val ?? ""));
      body = body.replace(ph, String(val ?? ""));
      if (url) url = url.replace(ph, String(val ?? ""));
    }

    return { title, body, url };
  }

  public async send(options: SendNotificationOptions): Promise<{ success: boolean; dispatchedChannels: string[] }> {
    const channels = options.channels && options.channels.length > 0 ? options.channels : ["in_app"];
    const dispatched: string[] = [];

    if (channels.includes("in_app")) {
      const item: NotificationItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: options.title,
        subtitle: options.body,
        category: options.category ?? "system",
        severity: options.severity ?? "medium",
        iconKey: options.iconKey ?? "bell",
        timestamp: new Date().toISOString(),
        href: options.url ?? "/dashboard/notifications",
        isRead: false,
        isPinned: false,
        isArchived: false,
      };

      const existing = this.inAppNotifications.get(options.businessId) ?? [];
      existing.unshift(item);
      if (existing.length > 200) existing.pop();
      this.inAppNotifications.set(options.businessId, existing);
      dispatched.push("in_app");
    }

    if (channels.includes("push")) {
      await deliveryService.deliver("send_push", {
        title: options.title,
        body: options.body,
        url: options.url,
        priority: (options.severity === "critical" || options.severity === "high") ? "critical" : "medium",
        target: { userId: options.userId },
      });
      dispatched.push("push");
    }

    if (channels.includes("email")) {
      await deliveryService.deliver("send_email", {
        title: options.title,
        body: options.body,
        url: options.url,
        priority: (options.severity === "critical" || options.severity === "high") ? "critical" : "medium",
      });
      dispatched.push("email");
    }

    if (channels.includes("whatsapp")) {
      await deliveryService.deliver("send_whatsapp", {
        title: options.title,
        body: options.body,
        url: options.url,
        priority: (options.severity === "critical" || options.severity === "high") ? "critical" : "medium",
        target: options.targetPhone ? { phone: options.targetPhone } : undefined,
      });
      dispatched.push("whatsapp");
    }

    void AuditService.record({
      businessId: options.businessId,
      userId: options.userId ?? "system",
      action: "NOTIFICATION_DISPATCHED",
      entityType: "notification",
      entityId: options.title,
      metadata: {
        category: options.category,
        severity: options.severity,
        channels: dispatched,
      },
    });

    return { success: true, dispatchedChannels: dispatched };
  }

  public getInAppNotifications(businessId: string): NotificationItem[] {
    return this.inAppNotifications.get(businessId) ?? [];
  }
}

export const notificationEngine = NotificationEngine.getInstance();
