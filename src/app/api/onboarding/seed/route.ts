import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Creates demo data for new workspaces
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId && !req.headers.get("x-workspace-id")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const workspaceId = body.workspaceId ?? session?.user?.workspaceId;

  // Create demo campaigns
  const channels = ["google_ads", "meta_ads", "instagram"];
  const campaigns = await Promise.all(
    channels.map((channel, i) =>
      db.campaign.create({
        data: {
          workspaceId,
          name: `Campanha Demo — ${channel.replace("_", " ").toUpperCase()}`,
          channel,
          status: "ACTIVE",
          budget: 5000 + i * 2000,
        },
      })
    )
  );

  // Create 30 days of demo metrics for each campaign
  const metricsData = [];
  for (const campaign of campaigns) {
    for (let d = 29; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);

      const baseImpressions = 10000 + Math.random() * 5000;
      const baseCTR = 0.02 + Math.random() * 0.03;
      const clicks = Math.floor(baseImpressions * baseCTR);
      const leads = Math.floor(clicks * (0.05 + Math.random() * 0.1));
      const conversions = Math.floor(leads * (0.1 + Math.random() * 0.2));
      const spend = 150 + Math.random() * 100;
      const revenue = spend * (2 + Math.random() * 4);

      metricsData.push({
        workspaceId,
        campaignId: campaign.id,
        date,
        impressions: Math.floor(baseImpressions),
        clicks,
        leads,
        conversions,
        spend,
        revenue,
        ctr: baseCTR * 100,
        cpc: spend / clicks,
        cpl: leads > 0 ? spend / leads : null,
        roas: revenue / spend,
        source: "demo",
      });
    }
  }

  await db.metric.createMany({ data: metricsData });

  // Create demo missions
  await db.mission.createMany({
    data: [
      {
        workspaceId,
        title: "Reduzir CPL em 20%",
        description: "Otimize segmentação e criativos para reduzir o custo por lead",
        metric: "leads",
        target: 500,
        current: 320,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
      {
        workspaceId,
        title: "Atingir 1.000 leads",
        description: "Escale suas campanhas para chegar a 1.000 leads no mês",
        metric: "leads",
        target: 1000,
        current: 450,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
      {
        workspaceId,
        title: "ROAS acima de 5x",
        description: "Melhore a qualidade dos leads para aumentar o ROAS",
        metric: "roas",
        target: 5,
        current: 3.2,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    ],
  });

  return NextResponse.json({ ok: true, campaigns: campaigns.length, metrics: metricsData.length });
}
