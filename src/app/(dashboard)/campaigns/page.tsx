import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    include: {
      metrics: {
        where: { date: { gte: since30 } },
      },
      healthScores: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const campaignsWithMetrics = campaigns.map((c) => {
    const totals = c.metrics.reduce(
      (acc, m) => ({
        spend: acc.spend + (m.spend ?? 0),
        leads: acc.leads + (m.leads ?? 0),
        clicks: acc.clicks + (m.clicks ?? 0),
        conversions: acc.conversions + (m.conversions ?? 0),
        impressions: acc.impressions + (m.impressions ?? 0),
      }),
      { spend: 0, leads: 0, clicks: 0, conversions: 0, impressions: 0 }
    );

    return {
      ...c,
      totals,
      latestScore: c.healthScores[0]?.score ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} ativas
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      <CampaignTable campaigns={campaignsWithMetrics} />
    </div>
  );
}
