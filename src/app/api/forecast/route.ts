import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateForecast } from "@/services/forecast";

export async function GET(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const metric = searchParams.get("metric") ?? "leads";

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const validMetrics = ["leads", "conversions", "spend", "revenue"] as const;
  if (!validMetrics.includes(metric as (typeof validMetrics)[number])) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const data = await generateForecast(
    session.user.workspaceId,
    campaignId,
    metric as (typeof validMetrics)[number]
  );

  return NextResponse.json({ data });
}
