import type { AggregateContext } from "./types";

/** Compute a numeric aggregate for a list of values. */
export function computeNumericAggregate(values: any[]): {
  count: number;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
} {
  const numeric = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (numeric.length === 0) return { count: 0, sum: null, avg: null, min: null, max: null };
  const sum = numeric.reduce((acc, n) => acc + n, 0);
  return {
    count: numeric.length,
    sum,
    avg: sum / numeric.length,
    min: Math.min(...numeric),
    max: Math.max(...numeric),
  };
}

export interface AggregateResult {
  aggregate: string | ((values: any[]) => any);
  context: AggregateContext;
  value: any;
}

/**
 * Resolve a column's `aggregate` config against a set of row values.
 * Supports `sum`, `count`, `avg`, `min`, `max` and custom functions.
 */
export function resolveAggregate(
  aggregate: "sum" | "count" | "avg" | "min" | "max" | ((values: any[]) => any),
  values: any[]
): AggregateResult {
  const ctx: AggregateContext = {
    rows: values,
    values,
    count: values.length,
    sum: null,
    avg: null,
    min: null,
    max: null,
  };

  const stats = computeNumericAggregate(values);
  ctx.sum = stats.sum;
  ctx.avg = stats.avg;
  ctx.min = stats.min;
  ctx.max = stats.max;

  let value: any;
  if (typeof aggregate === "function") {
    value = aggregate(values);
  } else {
    switch (aggregate) {
      case "sum":
        value = stats.sum;
        break;
      case "count":
        value = values.length;
        break;
      case "avg":
        value = stats.avg;
        break;
      case "min":
        value = stats.min;
        break;
      case "max":
        value = stats.max;
        break;
      default:
        value = null;
    }
  }

  return { aggregate, context: ctx, value };
}