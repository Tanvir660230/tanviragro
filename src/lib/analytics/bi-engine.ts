import type {
  PivotTableResult,
  AggregationFunction,
  AnalyticsWidgetType,
} from "./types";

export class BiEngine {
  /**
   * Generates a 2-dimensional Pivot Matrix with Row Totals, Column Totals, and Grand Total.
   */
  public static computePivotTable(
    records: Record<string, any>[],
    rowField: string,
    colField: string,
    valueField: string,
    aggregation: AggregationFunction = "sum"
  ): PivotTableResult {
    if (!records || records.length === 0) {
      return {
        rowHeaders: [],
        colHeaders: [],
        matrix: [],
        rowTotals: [],
        colTotals: [],
        grandTotal: 0,
      };
    }

    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    const cellBuckets = new Map<string, number[]>();

    for (const rec of records) {
      const rowVal = String(rec[rowField] ?? "Unknown");
      const colVal = String(rec[colField] ?? "Unknown");
      const numVal = Number(rec[valueField]) || 0;

      rowSet.add(rowVal);
      colSet.add(colVal);

      const cellKey = `${rowVal}:::${colVal}`;
      if (!cellBuckets.has(cellKey)) {
        cellBuckets.set(cellKey, []);
      }
      cellBuckets.get(cellKey)!.push(numVal);
    }

    const rowHeaders = Array.from(rowSet).sort();
    const colHeaders = Array.from(colSet).sort();

    const aggregateValues = (vals: number[]): number => {
      if (vals.length === 0) return 0;
      switch (aggregation) {
        case "sum":
          return vals.reduce((a, b) => a + b, 0);
        case "avg":
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        case "min":
          return Math.min(...vals);
        case "max":
          return Math.max(...vals);
        case "count":
        case "distinct_count":
          return vals.length;
        default:
          return vals.reduce((a, b) => a + b, 0);
      }
    };

    const matrix: (number | string | null)[][] = [];
    const rowTotals: number[] = [];
    const colTotals: number[] = new Array(colHeaders.length).fill(0);
    const allValues: number[] = [];

    for (let r = 0; r < rowHeaders.length; r++) {
      const rowVal = rowHeaders[r];
      const rowCells: number[] = [];
      const rowAggregateVals: number[] = [];

      for (let c = 0; c < colHeaders.length; c++) {
        const colVal = colHeaders[c];
        const cellVals = cellBuckets.get(`${rowVal}:::${colVal}`) || [];
        const cellAgg = cellVals.length > 0 ? parseFloat(aggregateValues(cellVals).toFixed(2)) : 0;
        rowCells.push(cellAgg);
        rowAggregateVals.push(...cellVals);
        allValues.push(...cellVals);
      }

      matrix.push(rowCells);
      rowTotals.push(rowAggregateVals.length > 0 ? parseFloat(aggregateValues(rowAggregateVals).toFixed(2)) : 0);
    }

    for (let c = 0; c < colHeaders.length; c++) {
      const colVal = colHeaders[c];
      const colVals: number[] = [];
      for (const rowVal of rowHeaders) {
        const vals = cellBuckets.get(`${rowVal}:::${colVal}`) || [];
        colVals.push(...vals);
      }
      colTotals[c] = colVals.length > 0 ? parseFloat(aggregateValues(colVals).toFixed(2)) : 0;
    }

    const grandTotal = allValues.length > 0 ? parseFloat(aggregateValues(allValues).toFixed(2)) : 0;

    return {
      rowHeaders,
      colHeaders,
      matrix,
      rowTotals,
      colTotals,
      grandTotal,
    };
  }

  /**
   * Cross filters an array of objects against an active multidimensional selection criteria.
   */
  public static computeCrossFilter<T extends Record<string, any>>(
    records: T[],
    activeFilters: Record<string, any>
  ): T[] {
    return records.filter((item) => {
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          continue;
        }
        if (Array.isArray(val)) {
          if (!val.includes(item[key])) return false;
        } else if (item[key] !== val) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Performs Top-N / Bottom-N ranking analysis.
   */
  public static computeTopBottomAnalysis<T extends Record<string, any>>(
    records: T[],
    metricField: string,
    limit = 5,
    mode: "top" | "bottom" = "top"
  ): T[] {
    const sorted = [...records].sort((a, b) => {
      const aVal = Number(a[metricField]) || 0;
      const bVal = Number(b[metricField]) || 0;
      return mode === "top" ? bVal - aVal : aVal - bVal;
    });
    return sorted.slice(0, limit);
  }

  /**
   * Intelligently selects the optimal chart type based on data dimensions and cardinality.
   */
  public static autoSelectVisualization(
    dimensionCount: number,
    metricCount: number,
    cardinality: number,
    isTimeSeries = false
  ): AnalyticsWidgetType {
    if (isTimeSeries) {
      return "line_chart";
    }
    if (dimensionCount === 1 && metricCount === 1) {
      if (cardinality <= 5) return "pie_chart";
      if (cardinality <= 20) return "bar_chart";
      return "data_table";
    }
    if (dimensionCount === 2) {
      return cardinality > 15 ? "heatmap" : "pivot_table";
    }
    if (dimensionCount === 0 && metricCount === 1) {
      return "kpi_card";
    }
    return "bar_chart";
  }
}
