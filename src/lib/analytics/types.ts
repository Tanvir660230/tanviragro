import type { AlertSeverity } from "@/lib/alerts/hierarchy";

export type ExecutiveRoleSlug =
  | "ceo"
  | "farm_manager"
  | "veterinarian"
  | "finance_manager"
  | "inventory_manager"
  | "operations_manager"
  | "sales_manager"
  | "system_admin"
  | "custom";

export type AnalyticsWidgetType =
  | "kpi_card"
  | "line_chart"
  | "bar_chart"
  | "pie_chart"
  | "area_chart"
  | "scatter_plot"
  | "gauge"
  | "heatmap"
  | "pivot_table"
  | "data_table"
  | "forecast_card"
  | "alert_feed"
  | "calendar_view"
  | "tree_map";

export type AnalyticsDataSource =
  | "kpi_engine"
  | "livestock"
  | "finance"
  | "feed"
  | "health"
  | "breeding"
  | "commerce"
  | "inventory"
  | "custom_query";

export type ReportDataset =
  | "cattle"
  | "financial_transactions"
  | "health_events"
  | "weight_logs"
  | "feed_mixes"
  | "breeding_attempts"
  | "orders"
  | "inventory_items";

export type AggregationFunction = "sum" | "avg" | "min" | "max" | "count" | "distinct_count";

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "between"
  | "in_list"
  | "is_empty"
  | "is_not_empty";

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  secondValue?: any;
}

export interface ReportSort {
  field: string;
  direction: "asc" | "desc";
}

export interface ReportAggregation {
  field: string;
  func: AggregationFunction;
  alias?: string;
}

export interface CustomReportConfig {
  fields: string[];
  filters?: ReportFilter[];
  groups?: string[];
  aggregations?: ReportAggregation[];
  sorting?: ReportSort[];
  pivotRows?: string[];
  pivotColumns?: string[];
  pivotValues?: ReportAggregation[];
  chartType?: AnalyticsWidgetType;
  limit?: number;
}

export interface CustomReportDefinition {
  id?: string;
  businessId?: string;
  title: string;
  description?: string;
  category: "executive" | "financial" | "livestock" | "health" | "feed_nutrition" | "breeding" | "commerce" | "inventory" | "governance" | "general";
  dataset: ReportDataset;
  config: CustomReportConfig;
  isPublic?: boolean;
  isTemplate?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportScheduleDefinition {
  id?: string;
  businessId?: string;
  reportId?: string;
  reportType: "custom" | "financial_statement" | "executive_summary" | "herd_health" | "feed_efficiency" | "reproduction_audit" | "commerce_daily";
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  hourOfDay: number;
  format: "pdf" | "excel" | "csv" | "json";
  recipients: string[];
  channels: ("email" | "whatsapp" | "webhook")[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}


export interface FarmFinancialKPIs {
  totalRevenue: number;
  totalOperatingExpense: number;
  grossMarginPercent: number;
  netFarmProfit: number;
  farmRoiPercent: number;
  totalInventoryValuation: number;
  totalBiologicalAssetValue: number;
  totalLiabilities: number;
  netEquity: number;
  cashRunwayDays: number;
  costPerKgGain: number;
  breakEvenPricePerKg: number;
  momRevenueGrowthPct?: number;
  momExpenseGrowthPct?: number;
}

export interface FarmBiologicalKPIs {
  activeHeadCount: number;
  totalLiveBiomassKg: number;
  averageWeightKg: number;
  averageDailyGainKg: number; // ADG
  feedConversionRatio?: number; // FCR
  mortalityRatePercent: number;
  birthRatePercent: number;
  breedingSuccessRatePercent: number;
  pregnancyRatePercent: number;
  averageDaysOnFeed: number;
  unweighedCattleCount: number;
}

export interface FarmInventoryKPIs {
  totalStockValuation: number;
  lowStockItemsCount: number;
  criticalStockOutCount: number;
  dailyFeedRunRateKg: number;
  dailyFeedCostBdt: number;
  inventoryTurnoverRatio: number;
  feedStockRunwayDays: number;
}

export interface FarmHealthKPIs {
  vaccinationComplianceRate: number;
  treatmentSuccessRate: number;
  activeWithdrawalCount: number;
  overdueMedicalEventsCount: number;
  quarantinedCount: number;
  activeTreatmentsCount: number;
}

export interface FarmCommerceKPIs {
  totalOrdersCount: number;
  totalGrossSalesBdt: number;
  averageOrderValueBdt: number;
  qurbaniBookingsCount: number;
  pendingDeliveriesCount: number;
  repeatCustomerRatePct: number;
}

export interface ExecutiveFarmSummary {
  financial: FarmFinancialKPIs;
  biological: FarmBiologicalKPIs;
  inventory: FarmInventoryKPIs;
  health: FarmHealthKPIs;
  commerce: FarmCommerceKPIs;
  asOf: string;
}

export interface OperationalAlertItem {
  id: string;
  category: "health" | "inventory" | "weight" | "financial" | "compliance" | "breeding" | "operations";
  severity: AlertSeverity;
  title: string;
  description: string;
  targetId?: string;
  actionUrl?: string;
  dueDate?: string;
  detectedAt?: string;
}

export interface MonthlyTrendDataPoint {
  monthKey: string; // YYYY-MM
  label: string;
  revenue: number;
  expense: number;
  netProfit: number;
  feedCost: number;
  biomassGainKg?: number;
  cattleSold?: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  value: number;
  predicted?: boolean;
  lowerBound?: number;
  upperBound?: number;
}

export interface PivotTableResult {
  rowHeaders: string[];
  colHeaders: string[];
  matrix: (number | string | null)[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
}

export interface ComparisonMetrics {
  currentValue: number;
  previousValue: number;
  changeValue: number;
  changePercent: number;
  trend: "up" | "down" | "flat";
  isFavorable: boolean;
}

export interface AnalyticsWidgetDefinition {
  id: string;
  title: string;
  widgetType: AnalyticsWidgetType;
  dataSource: AnalyticsDataSource;
  queryConfig: Record<string, any>;
  displayConfig: {
    colorTheme?: string;
    unit?: string;
    showSparkline?: boolean;
    format?: "currency" | "number" | "percent" | "duration";
    thresholds?: { warning?: number; critical?: number };
    [key: string]: any;
  };
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  data?: any;
}

export interface RoleDashboardConfig {
  roleSlug: ExecutiveRoleSlug;
  roleTitle: string;
  description: string;
  defaultWidgets: AnalyticsWidgetDefinition[];
  primaryKpis: string[];
  allowedExportFormats: ("pdf" | "excel" | "csv")[];
}