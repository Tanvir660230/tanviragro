import type {
  CustomReportConfig,
  CustomReportDefinition,
  ReportFilter,
  ReportAggregation,
  ReportSort,
  AggregationFunction,
} from "./types";

export interface ExecutedReportResult {
  columns: { key: string; label: string; type: "string" | "number" | "date" }[];
  rows: Record<string, any>[];
  summary: Record<string, number>;
  totalCount: number;
  generatedAt?: string;
}

export class CustomReportEngine {
  /**
   * Filters, groups, aggregates, and sorts raw dataset records according to a custom report configuration.
   */
  public static executeReport(
    records: Record<string, any>[],
    config: CustomReportConfig
  ): ExecutedReportResult {
    let dataset = [...(records || [])];

    // 1. Apply Filters
    if (config.filters && config.filters.length > 0) {
      dataset = dataset.filter((row) =>
        config.filters!.every((filter) => this.evaluateFilter(row, filter))
      );
    }

    // 2. Apply Grouping & Aggregations OR Raw Field Selection
    let processedRows: Record<string, any>[] = [];
    const summary: Record<string, number> = {};

    if (config.groups && config.groups.length > 0 && config.aggregations && config.aggregations.length > 0) {
      const groupMap = new Map<string, Record<string, any>[]>();

      for (const row of dataset) {
        const groupKey = config.groups.map((g) => String(row[g] ?? "")).join(" | ");
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey)!.push(row);
      }

      groupMap.forEach((groupRecords, groupKey) => {
        const rowObj: Record<string, any> = {};
        const groupKeyParts = groupKey.split(" | ");
        config.groups!.forEach((g, idx) => {
          rowObj[g] = groupKeyParts[idx];
        });

        for (const agg of config.aggregations!) {
          const colName = agg.alias || `${agg.func}_${agg.field}`;
          const val = this.calculateAggregation(groupRecords, agg.field, agg.func);
          rowObj[colName] = val;
        }

        processedRows.push(rowObj);
      });
    } else {
      processedRows = dataset.map((row) => {
        if (!config.fields || config.fields.length === 0) return { ...row };
        const rowObj: Record<string, any> = {};
        for (const f of config.fields) {
          rowObj[f] = row[f] ?? "";
        }
        return rowObj;
      });
    }

    // 3. Compute Summary Totals for Numeric Aggregations
    if (config.aggregations) {
      for (const agg of config.aggregations) {
        const colName = agg.alias || `${agg.func}_${agg.field}`;
        const totalVal = this.calculateAggregation(dataset, agg.field, agg.func);
        summary[colName] = totalVal;
      }
    }

    // 4. Apply Sorting
    if (config.sorting && config.sorting.length > 0) {
      processedRows.sort((a, b) => {
        for (const sort of config.sorting!) {
          const aVal = a[sort.field];
          const bVal = b[sort.field];
          if (aVal !== bVal) {
            const comparison =
              typeof aVal === "number" && typeof bVal === "number"
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal));
            return sort.direction === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    // 5. Apply Limit
    if (config.limit && config.limit > 0) {
      processedRows = processedRows.slice(0, config.limit);
    }

    // 6. Build Columns definition
    const sample = processedRows[0] || {};
    const columns = Object.keys(sample).map((key) => {
      const val = sample[key];
      const type: "string" | "number" | "date" =
        typeof val === "number" ? "number" : String(val).match(/^\d{4}-\d{2}-\d{2}/) ? "date" : "string";
      const label = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { key, label, type };
    });

    return {
      columns,
      rows: processedRows,
      summary,
      totalCount: dataset.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private static evaluateFilter(row: Record<string, any>, filter: ReportFilter): boolean {
    const rawVal = row[filter.field];
    const targetVal = filter.value;

    switch (filter.operator) {
      case "equals":
        return String(rawVal).toLowerCase() === String(targetVal).toLowerCase();
      case "not_equals":
        return String(rawVal).toLowerCase() !== String(targetVal).toLowerCase();
      case "contains":
        return String(rawVal).toLowerCase().includes(String(targetVal).toLowerCase());
      case "greater_than":
        return Number(rawVal) > Number(targetVal);
      case "less_than":
        return Number(rawVal) < Number(targetVal);
      case "between":
        return Number(rawVal) >= Number(targetVal) && Number(rawVal) <= Number(filter.secondValue);
      case "in_list":
        if (Array.isArray(targetVal)) {
          return targetVal.map(String).includes(String(rawVal));
        }
        return false;
      case "is_empty":
        return rawVal === undefined || rawVal === null || rawVal === "";
      case "is_not_empty":
        return rawVal !== undefined && rawVal !== null && rawVal !== "";
      default:
        return true;
    }
  }

  private static calculateAggregation(
    records: Record<string, any>[],
    field: string,
    func: AggregationFunction
  ): number {
    if (!records || records.length === 0) return 0;

    const values = records
      .map((r) => Number(r[field]))
      .filter((n) => !isNaN(n));

    switch (func) {
      case "sum":
        return parseFloat(values.reduce((acc, v) => acc + v, 0).toFixed(2));
      case "avg":
        return values.length > 0
          ? parseFloat((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2))
          : 0;
      case "min":
        return values.length > 0 ? Math.min(...values) : 0;
      case "max":
        return values.length > 0 ? Math.max(...values) : 0;
      case "count":
        return records.length;
      case "distinct_count":
        return new Set(records.map((r) => r[field])).size;
      default:
        return 0;
    }
  }

  /**
   * Generates CSV format text for any executed custom report.
   */
  public static generateCSV(
    title: string,
    columns: { key: string; label: string }[],
    rows: Record<string, any>[]
  ): string {
    const headerRow = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const dataRows = rows.map((r) =>
      columns
        .map((c) => {
          const v = r[c.key] ?? "";
          if (typeof v === "number") return v;
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    return [`# ${title}`, headerRow, ...dataRows].join("\n");
  }

  /**
   * Standard pre-built templates for fast report creation without coding.
   */
  public static getDefaultTemplates(): CustomReportDefinition[] {
    return [
      {
        title: "Herd Liveweight & ADG Performance",
        description: "Active cattle batch weight analysis, daily gain rates, and days on feed",
        category: "livestock",
        dataset: "cattle",
        config: {
          fields: ["tag_number", "breed", "gender", "purchase_weight_kg", "current_weight_kg", "days_on_feed"],
          sorting: [{ field: "current_weight_kg", direction: "desc" }],
          chartType: "bar_chart",
        },
        isTemplate: true,
      },
      {
        title: "Veterinary Compliance & Quarantine Audit",
        description: "Summary of vaccination, medical events, and active drug withdrawal restrictions",
        category: "health",
        dataset: "health_events",
        config: {
          fields: ["cattle_tag", "event_type", "title", "treatment_date", "cost", "withdrawal_days"],
          sorting: [{ field: "treatment_date", direction: "desc" }],
          chartType: "data_table",
        },
        isTemplate: true,
      },
      {
        title: "Feed Consumption & Cost Distribution",
        description: "Ration inventory consumption breakdown and feed expenditure",
        category: "feed_nutrition",
        dataset: "inventory_items",
        config: {
          fields: ["name", "category", "unit", "current_stock", "unit_cost", "reorder_threshold"],
          sorting: [{ field: "current_stock", direction: "asc" }],
          chartType: "pie_chart",
        },
        isTemplate: true,
      },
      {
        title: "Executive Revenue & Profit Realization",
        description: "Consolidated sales revenue vs cattle cost and gross margins",
        category: "financial",
        dataset: "financial_transactions",
        config: {
          fields: ["transaction_date", "category", "description", "amount", "payment_method"],
          sorting: [{ field: "transaction_date", direction: "desc" }],
          chartType: "line_chart",
        },
        isTemplate: true,
      },
    ];
  }
}
