import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { webhookIngestSchema } from "@/lib/validations";
import { verifyWebhookSignature } from "@/lib/utils";
import { calculateDerivedMetrics } from "@/lib/utils";
import { invalidateCache } from "@/lib/redis";

// Ingest endpoint for n8n and external integrations
// Secured via HMAC-SHA256 webhook signature
export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req, "webhook");
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // Verify HMAC signature
  const signature = req.headers.get("x-nufluma-signature");
  if (!signature || !process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const rawBody = await req.text();

  const isValid = verifyWebhookSignature(rawBody, signature, process.env.WEBHOOK_SECRET);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const parsed = webhookIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { workspaceId, source, data } = parsed.data;

  // Verify workspace exists
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Validate all campaigns
  const campaignIds = [...new Set(data.map((m) => m.campaignId))];
  const campaigns = await db.campaign.findMany({
    where: { id: { in: campaignIds }, workspaceId },
    select: { id: true },
  });
  const validIds = new Set(campaigns.map((c) => c.id));

  const validMetrics = data.filter((m) => validIds.has(m.campaignId));

  if (validMetrics.length === 0) {
    return NextResponse.json({ error: "No valid campaigns found", inserted: 0 });
  }

  const metricsData = validMetrics.map((m) => {
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
      source,
      ...derived,
    };
  });

  await db.metric.createMany({ data: metricsData, skipDuplicates: false });

  // Invalidate caches
  await invalidateCache(`metrics:${workspaceId}:*`);
  await invalidateCache(`hs:${workspaceId}:*`);
  await invalidateCache(`insight:${workspaceId}:*`);

  return NextResponse.json({ inserted: metricsData.length, skipped: data.length - validMetrics.length });
}
