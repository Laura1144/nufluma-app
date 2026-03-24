import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeHealthScore } from "@/services/health-score";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id }, select: { name: true } });
  return { title: campaign?.name ?? "Campanha" };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const [campaign, healthScores] = await Promise.all([
    db.campaign.findFirst({
      where: { id, workspaceId },
      include: {
        metrics: {
          where: { date: { gte: since30 } },
          orderBy: { date: "asc" },
        },
      },
    }),
    computeHealthScore(workspaceId, id),
  ]);

  if (!campaign) notFound();

  const totals = campaign.metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + (m.spend ?? 0),
      leads: acc.leads + (m.leads ?? 0),
      clicks: acc.clicks + (m.clicks ?? 0),
      impressions: acc.impressions + (m.impressions ?? 0),
      conversions: acc.conversions + (m.conversions ?? 0),
      revenue: acc.revenue + (m.revenue ?? 0),
    }),
    { spend: 0, leads: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 }
  );

  const chartData = campaign.metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    leads: m.leads ?? 0,
    clicks: m.clicks ?? 0,
    conversions: m.conversions ?? 0,
    spend: m.spend ?? 0,
  }));

  const score = healthScores[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="capitalize">
              {campaign.channel.replace("_", " ")}
            </Badge>
            <Badge variant={campaign.status === "ACTIVE" ? "success" : "secondary"}>
              {campaign.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Investimento", value: formatCurrency(totals.spend) },
          { label: "Leads", value: formatNumber(totals.leads) },
          { label: "Cliques", value: formatNumber(totals.clicks) },
          { label: "CTR", value: totals.impressions > 0 ? formatPercent((totals.clicks / totals.impressions) * 100) : "—" },
          { label: "CPL", value: totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : "—" },
          { label: "ROAS", value: totals.spend > 0 ? `${(totals.revenue / totals.spend).toFixed(1)}x` : "—" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mt-0.5">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MetricsChart data={chartData} title="Performance (últimos 30 dias)" />
        </div>
        {score && (
          <HealthScoreCard data={score} />
        )}
      </div>
    </div>
  );
}
