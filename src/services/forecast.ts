import { db } from "@/lib/db";
import type { ForecastDataPoint } from "@/types";

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0 };

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumXX = x.reduce((a, xi) => a + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const yMean = sumY / n;
  const ssTot = y.reduce((a, yi) => a + (yi - yMean) ** 2, 0);
  const ssRes = y.reduce(
    (a, yi, i) => a + (yi - (slope * x[i] + intercept)) ** 2,
    0
  );
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

export async function generateForecast(
  workspaceId: string,
  campaignId: string,
  metric: "leads" | "conversions" | "spend" | "revenue",
  horizonDays = 30
): Promise<ForecastDataPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const metrics = await db.metric.findMany({
    where: {
      workspaceId,
      campaignId,
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  if (metrics.length < 7) {
    // Not enough data — return flat forecast
    const last = metrics.at(-1)?.[metric] ?? 0;
    return Array.from({ length: horizonDays }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);
      return {
        date: date.toISOString().split("T")[0],
        predicted: last,
        lower: last * 0.8,
        upper: last * 1.2,
      };
    });
  }

  const x = metrics.map((_, i) => i);
  const y = metrics.map((m) => m[metric] ?? 0);

  const { slope, intercept, r2 } = linearRegression(x, y);
  const confidence = Math.min(0.95, r2);
  const stderr = Math.sqrt(
    y.reduce((a, yi, i) => a + (yi - (slope * i + intercept)) ** 2, 0) /
      Math.max(1, y.length - 2)
  );

  const points: ForecastDataPoint[] = [];
  const lastX = metrics.length - 1;

  for (let i = 1; i <= horizonDays; i++) {
    const xi = lastX + i;
    const predicted = Math.max(0, slope * xi + intercept);
    const margin = 1.96 * stderr; // 95% CI

    const date = new Date();
    date.setDate(date.getDate() + i);

    points.push({
      date: date.toISOString().split("T")[0],
      predicted: Math.round(predicted * 100) / 100,
      lower: Math.max(0, Math.round((predicted - margin) * 100) / 100),
      upper: Math.round((predicted + margin) * 100) / 100,
    });
  }

  // Persist to DB
  await db.forecast.createMany({
    data: points.map((p) => ({
      workspaceId,
      campaignId,
      targetDate: new Date(p.date),
      metric,
      predicted: p.predicted,
      lowerBound: p.lower,
      upperBound: p.upper,
      confidence,
      model: "linear",
    })),
    skipDuplicates: true,
  });

  return points;
}

export async function getForecastWithActuals(
  workspaceId: string,
  campaignId: string,
  metric: string
): Promise<ForecastDataPoint[]> {
  const forecasts = await db.forecast.findMany({
    where: { workspaceId, campaignId, metric },
    orderBy: { targetDate: "asc" },
    take: 60,
  });

  const actuals = await db.metric.findMany({
    where: { workspaceId, campaignId },
    orderBy: { date: "asc" },
    take: 90,
  });

  const actualMap = new Map(
    actuals.map((m) => [
      m.date.toISOString().split("T")[0],
      m[metric as keyof typeof m] as number,
    ])
  );

  return forecasts.map((f) => ({
    date: f.targetDate.toISOString().split("T")[0],
    predicted: f.predicted,
    lower: f.lowerBound,
    upper: f.upperBound,
    actual: actualMap.get(f.targetDate.toISOString().split("T")[0]),
  }));
}
