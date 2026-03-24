import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createCampaignSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "20"), 100);

  const where = {
    workspaceId: session.user.workspaceId,
    ...(status ? { status: status as "ACTIVE" | "PAUSED" | "ENDED" | "DRAFT" } : {}),
  };

  const [campaigns, total] = await Promise.all([
    db.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.campaign.count({ where }),
  ]);

  return NextResponse.json({
    data: campaigns,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const campaign = await db.campaign.create({
    data: {
      ...parsed.data,
      workspaceId: session.user.workspaceId,
    },
  });

  await Promise.all([
    createAuditLog({
      workspaceId: session.user.workspaceId,
      userId: session.user.id,
      action: "CREATE",
      resource: "campaign",
      resourceId: campaign.id,
    }),
    invalidateCache(CACHE_KEYS.campaigns(session.user.workspaceId)),
  ]);

  return NextResponse.json({ data: campaign }, { status: 201 });
}
