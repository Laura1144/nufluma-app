import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { generateCreativeSuggestions } from "@/services/ai-insights";

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = session.user.workspaceId as string;
  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  // Verify ownership
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const raw = await generateCreativeSuggestions(workspaceId, campaignId);

  const suggestions = await db.suggestion.createManyAndReturn({
    data: raw.map((s) => ({
      workspaceId,
      campaignId,
      type: (s.type ?? "COPY") as "COPY" | "CTA" | "CREATIVE" | "ANGLE" | "BUDGET" | "TARGETING",
      title: s.title ?? "Sugestão",
      content: s.content ?? "",
      rationale: s.rationale,
      generatedBy: "ai",
    })),
  });

  return NextResponse.json({ suggestions }, { status: 201 });
}
