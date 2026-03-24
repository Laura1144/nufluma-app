import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { BenchmarkView } from "@/components/benchmarks/benchmark-view";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { INDUSTRY_BENCHMARKS } from "@/lib/constants";

export const metadata: Metadata = { title: "Benchmarks" };

export default async function BenchmarksPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [metrics, workspace] = await Promise.all([
    db.metric.aggregate({
      where: { workspaceId, date: { gte: since30 } },
      _sum: {
        spend: true, leads: true, clicks: true,
        impressions: true, conversions: true,
      },
      _avg: { ctr: true, cpc: true, cpl: true, roas: true },
    }),
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { industry: true },
    }),
  ]);

  const clientMetrics = {
    ctr: metrics._avg.ctr ?? 0,
    cpc: metrics._avg.cpc ?? 0,
    cpl: metrics._avg.cpl ?? 0,
    roas: metrics._avg.roas ?? 0,
    convRate: metrics._sum.clicks && metrics._sum.conversions
      ? (metrics._sum.conversions / metrics._sum.clicks) * 100 : 0,
  };

  // Industry benchmarks (valores centralizados em src/lib/constants.ts)
  const formatFn: Record<string, (v: number) => string> = {
    percent:    (v) => formatPercent(v),
    currency:   (v) => formatCurrency(v),
    multiplier: (v) => `${v.toFixed(1)}x`,
  };
  const industryBenchmarks = Object.fromEntries(
    Object.entries(INDUSTRY_BENCHMARKS).map(([key, b]) => [
      key,
      { avg: b.avg, label: b.label, format: formatFn[b.format] },
    ])
  ) as Record<string, { avg: number; label: string; format: (v: number) => string }>;

  const comparisons = Object.entries(industryBenchmarks).map(([key, bench]) => {
    const clientVal = clientMetrics[key as keyof typeof clientMetrics];
    const isInverted = key === "cpc" || key === "cpl";
    const diff = isInverted
      ? ((bench.avg - clientVal) / bench.avg) * 100
      : ((clientVal - bench.avg) / bench.avg) * 100;

    return {
      metric: key,
      label: bench.label,
      clientValueFormatted: bench.format(clientVal),
      industryAvgFormatted: bench.format(bench.avg),
      percentile: Math.max(0, Math.min(100, 50 + diff)),
      status: (diff > 10 ? "above" : diff < -10 ? "below" : "average") as "above" | "average" | "below",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Benchmarks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare sua performance com a média do setor{workspace?.industry ? ` (${workspace.industry})` : ""}
        </p>
      </div>
      <BenchmarkView comparisons={comparisons} />
    </div>
  );
}
