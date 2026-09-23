/**
 * Tanvir Agro ERP — Enterprise Notification Center Types
 */

import { AlertSeverity } from "../alerts/hierarchy";

export type NotificationCategory =
  | "all"
  | "cattle"
  | "inventory"
  | "finance"
  | "compliance"
  | "system";

export type NotificationFilterState = "all" | "unread" | "pinned" | "archived";

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  category: NotificationCategory;
  severity: AlertSeverity;
  iconKey: "heart" | "package" | "landmark" | "shield" | "scale" | "dollar" | "alert" | "info" | "bell";
  timestamp: string; // ISO 8601
  href: string;
  isRead: boolean;
  isPinned: boolean;
  isArchived: boolean;
  sourceEventId?: string;
  actionLabel?: string;
}

export interface NotificationFeedSummary {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}
