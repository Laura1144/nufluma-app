import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { computeHealthScore } from "@/services/health-score";

export async function GET(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") ?? undefined;
  const period = (searchParams.get("period") ?? "30d") as "7d" | "30d" | "90d";

  const scores = await computeHealthScore(session.user.workspaceId, campaignId, period);

  return NextResponse.json({ data: scores });
}
