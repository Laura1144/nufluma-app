import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { MissionsPanel } from "@/components/dashboard/missions-panel";
import { AiInsightBanner } from "@/components/dashboard/ai-insight-banner";
import { computeHealthScore } from "@/services/health-score";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import {
  DollarSign,
  Users,
  MousePointerClick,
  TrendingUp,
  Percent,
  ShoppingCart,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardData(workspaceId: string) {
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const since60 = new Date();
  since60.setDate(since60.getDate() - 60);

  const [current, previous, chartData, healthScores, missions] =
    await Promise.all([
      // Current period aggregates
      db.metric.aggregate({
        where: { workspaceId, date: { gte: since30 } },
        _sum: {
          spend: true,
          leads: true,
          clicks: true,
          impressions: true,
          conversions: true,
          revenue: true,
        },
      }),
      // Previous period
      db.metric.aggregate({
        where: {
          workspaceId,
          date: { gte: since60, lt: since30 },
        },
        _sum: {
          spend: true,
          leads: true,
          clicks: true,
          impressions: true,
          conversions: true,
        },
      }),
      // Chart data (last 30 days grouped by day)
      db.metric.groupBy({
        by: ["date"],
        where: { workspaceId, date: { gte: since30 } },
        _sum: {
          leads: true,
          clicks: true,
          conversions: true,
          spend: true,
        },
        orderBy: { date: "asc" },
      }),
      // Health scores
      computeHealthScore(workspaceId),
      // Missions
      db.mission.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

  const curr = current._sum;
  const prev = previous._sum;

  const trend = (curr: number | null, prev: number | null, invert = false) => {
    if (!curr || !prev || prev === 0) return 0;
    const t = ((curr - prev) / prev) * 100;
    return invert ? -t : t;
  };

  const avgCTR =
    curr.impressions && curr.clicks
      ? (curr.clicks / curr.impressions) * 100
      : 0;
  const avgCPL =
    curr.leads && curr.spend ? curr.spend / curr.leads : 0;
  const avgROAS =
    curr.spend && curr.revenue ? curr.revenue / curr.spend : 0;

  const chartFormatted = chartData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    leads: d._sum.leads ?? 0,
    clicks: d._sum.clicks ?? 0,
    conversions: d._sum.conversions ?? 0,
    spend: d._sum.spend ?? 0,
  }));

  return {
    kpis: {
      spend: curr.spend ?? 0,
      leads: curr.leads ?? 0,
      clicks: curr.clicks ?? 0,
      conversions: curr.conversions ?? 0,
      ctr: avgCTR,
      cpl: avgCPL,
      roas: avgROAS,
      trends: {
        spend: trend(curr.spend, prev.spend),
        leads: trend(curr.leads, prev.leads),
        clicks: trend(curr.clicks, prev.clicks),
        conversions: trend(curr.conversions, prev.conversions),
        cpl: trend(avgCPL, prev.leads && prev.spend ? prev.spend / prev.leads : null, true),
      },
    },
    chartData: chartFormatted,
    healthScores,
    missions,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const { kpis, chartData, healthScores, missions } =
    await getDashboardData(workspaceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance dos últimos 30 dias
        </p>
      </div>

      {/* AI Insight Banner */}
      <AiInsightBanner workspaceId={workspaceId} />

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Investimento"
          value={formatCurrency(kpis.spend)}
          trend={kpis.trends.spend}
          trendLabel="vs mês ant."
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          index={0}
        />
        <KpiCard
          title="Leads"
          value={formatNumber(kpis.leads)}
          trend={kpis.trends.leads}
          trendLabel="vs mês ant."
          icon={<Users className="h-5 w-5 text-primary" />}
          index={1}
        />
        <KpiCard
          title="Cliques"
          value={formatNumber(kpis.clicks)}
          trend={kpis.trends.clicks}
          trendLabel="vs mês ant."
          icon={<MousePointerClick className="h-5 w-5 text-primary" />}
          index={2}
        />
        <KpiCard
          title="CTR Médio"
          value={formatPercent(kpis.ctr)}
          icon={<Percent className="h-5 w-5 text-primary" />}
          index={3}
        />
        <KpiCard
          title="CPL Médio"
          value={formatCurrency(kpis.cpl)}
          trend={kpis.trends.cpl}
          trendLabel="vs mês ant."
          icon={<ShoppingCart className="h-5 w-5 text-primary" />}
          index={4}
        />
        <KpiCard
          title="ROAS"
          value={`${kpis.roas.toFixed(1)}x`}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          index={5}
        />
      </div>

      {/* Charts + Missions row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MetricsChart
            data={chartData}
            title="Evolução de Performance"
            description="Leads, cliques e conversões nos últimos 30 dias"
          />
        </div>
        <MissionsPanel missions={missions} />
      </div>

      {/* Health Scores */}
      {healthScores.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Health Score por Campanha</h2>
            <p className="text-sm text-muted-foreground">
              Score 0–100 baseado em CTR, CPC, CPL, conversão e ROAS
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {healthScores.slice(0, 6).map((score, i) => (
              <HealthScoreCard key={score.campaignId} data={score} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
