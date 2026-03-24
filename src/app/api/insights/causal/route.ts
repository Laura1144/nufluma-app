import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { generateCausalInsight } from "@/services/ai-insights";
import { withCache } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "30d";
  const workspaceId = session.user.workspaceId as string;

  const cacheKey = `insight:${workspaceId}:${period}`;

  const insight = await withCache(
    cacheKey,
    () => generateCausalInsight(workspaceId, undefined, period),
    1800 // 30 minutes cache
  );

  return NextResponse.json({ insight });
}
