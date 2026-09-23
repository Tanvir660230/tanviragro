import type { TimeSeriesPoint } from "./types";

export interface ForecastResult {
  historical: TimeSeriesPoint[];
  forecast: TimeSeriesPoint[];
  slope: number;
  rSquared: number;
  projectedEndValue: number;
}

export class ForecastEngine {
  /**
   * Fits a linear regression line to historical numeric time series points and projects future intervals.
   */
  public static linearRegressionForecast(
    historicalData: { timestamp: string; label: string; value: number }[],
    projectionSteps = 3,
    varianceBandPct = 0.1
  ): ForecastResult {
    const n = historicalData.length;
    if (n === 0) {
      return {
        historical: [],
        forecast: [],
        slope: 0,
        rSquared: 0,
        projectedEndValue: 0,
      };
    }

    if (n === 1) {
      const val = historicalData[0].value;
      const forecast: TimeSeriesPoint[] = [];
      for (let i = 1; i <= projectionSteps; i++) {
        forecast.push({
          timestamp: `+${i}m`,
          label: `Projection ${i}`,
          value: val,
          predicted: true,
          lowerBound: parseFloat((val * (1 - varianceBandPct)).toFixed(2)),
          upperBound: parseFloat((val * (1 + varianceBandPct)).toFixed(2)),
        });
      }
      return {
        historical: historicalData,
        forecast,
        slope: 0,
        rSquared: 1,
        projectedEndValue: val,
      };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = historicalData[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (Coefficient of Determination)
    const numerator = Math.pow(n * sumXY - sumX * sumY, 2);
    const denominator = (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY);
    const rSquared = denominator !== 0 ? Math.min(1, Math.max(0, numerator / denominator)) : 0;

    const forecast: TimeSeriesPoint[] = [];
    let projectedEndValue = 0;

    for (let step = 1; step <= projectionSteps; step++) {
      const xFuture = n - 1 + step;
      const predictedVal = Math.max(0, slope * xFuture + intercept);
      const margin = predictedVal * (varianceBandPct * step);

      projectedEndValue = parseFloat(predictedVal.toFixed(2));
      forecast.push({
        timestamp: `+${step}`,
        label: `M+${step}`,
        value: projectedEndValue,
        predicted: true,
        lowerBound: parseFloat(Math.max(0, predictedVal - margin).toFixed(2)),
        upperBound: parseFloat((predictedVal + margin).toFixed(2)),
      });
    }

    return {
      historical: historicalData,
      forecast,
      slope: parseFloat(slope.toFixed(4)),
      rSquared: parseFloat(rSquared.toFixed(4)),
      projectedEndValue,
    };
  }

  /**
   * Computes Simple Moving Average (SMA) over a sliding window.
   */
  public static movingAverage(values: number[], windowSize = 3): number[] {
    if (values.length === 0 || windowSize <= 0) return [];
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const subset = values.slice(start, i + 1);
      const avg = subset.reduce((sum, v) => sum + v, 0) / subset.length;
      result.push(parseFloat(avg.toFixed(2)));
    }

    return result;
  }

  /**
   * Forecasts future feed requirements and costs for a herd over a given number of days.
   */
  public static forecastFeedRequirement(
    activeHeadCount: number,
    dailyFeedPerHeadKg: number,
    unitFeedCostBdt: number,
    daysAhead = 30
  ): {
    projectedTotalFeedKg: number;
    projectedTotalCostBdt: number;
    dailyRunRateBdt: number;
  } {
    const dailyTotalKg = activeHeadCount * dailyFeedPerHeadKg;
    const dailyCost = dailyTotalKg * unitFeedCostBdt;
    const projectedTotalFeedKg = dailyTotalKg * daysAhead;
    const projectedTotalCostBdt = dailyCost * daysAhead;

    return {
      projectedTotalFeedKg: Math.round(projectedTotalFeedKg),
      projectedTotalCostBdt: Math.round(projectedTotalCostBdt),
      dailyRunRateBdt: Math.round(dailyCost),
    };
  }
}
