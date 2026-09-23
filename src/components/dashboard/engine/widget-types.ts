export type DashboardRole =
  | "owner"
  | "manager"
  | "accountant"
  | "veterinarian"
  | "staff"
  | "partner";

export type WidgetCategory =
  | "command"
  | "kpi"
  | "analytics"
  | "operations"
  | "financial"
  | "health"
  | "livestock"
  | "inventory"
  | "ai"
  | "activity";

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  description: string;
  defaultVisible: boolean;
  category: WidgetCategory;
  minRole?: DashboardRole[];
  order: number;
}

export interface DashboardPersonalizationState {
  role: DashboardRole;
  visibleWidgetIds: string[];
  pinnedWidgetIds: string[];
  widgetOrder: string[];
}
