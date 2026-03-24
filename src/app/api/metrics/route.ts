import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { batchIngestSchema } from "@/lib/validations";
import { calculateDerivedMetrics } from "@/lib/utils";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = batchIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { metrics } = parsed.data;
  const workspaceId = session.user.workspaceId;

  // Validate all campaigns belong to workspace
  const campaignIds = [...new Set(metrics.map((m) => m.campaignId))];
  const campaigns = await db.campaign.findMany({
    where: { id: { in: campaignIds }, workspaceId },
    select: { id: true },
  });

  const validIds = new Set(campaigns.map((c) => c.id));
  const invalidCampaigns = campaignIds.filter((id) => !validIds.has(id));
  if (invalidCampaigns.length > 0) {
    return NextResponse.json(
      { error: `Campanhas não encontradas: ${invalidCampaigns.join(", ")}` },
      { status: 422 }
    );
  }

  const data = metrics.map((m) => {
    const derived = calculateDerivedMetrics(m);
    return {
      workspaceId,
      campaignId: m.campaignId,
      date: new Date(m.date),
      impressions: m.impressions,
      clicks: m.clicks,
      leads: m.leads,
      conversions: m.conversions,
      spend: m.spend,
      revenue: m.revenue,
      source: m.source ?? "api",
      ...derived,
    };
  });

  await db.metric.createMany({ data, skipDuplicates: false });

  // Invalidate related caches
  await invalidateCache(`metrics:${workspaceId}:*`);
  await invalidateCache(`hs:${workspaceId}:*`);

  return NextResponse.json({ inserted: data.length }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const period = searchParams.get("period") ?? "30d";

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const metrics = await db.metric.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      ...(campaignId ? { campaignId } : {}),
      date: { gte: since },
    },
    orderBy: { date: "asc" },
    take: 1000,
  });

  return NextResponse.json({ data: metrics });
}
