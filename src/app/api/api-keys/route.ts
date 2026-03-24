import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createApiKeySchema } from "@/lib/validations";
import { generateApiKey, hashApiKey } from "@/lib/utils";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  await db.apiKey.create({
    data: {
      workspaceId: session.user.workspaceId,
      name: parsed.data.name,
      keyHash,
      keyPrefix,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  await createAuditLog({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: "CREATE",
    resource: "api_key",
    details: { name: parsed.data.name },
  });

  // Only return the raw key once
  return NextResponse.json({ key: rawKey }, { status: 201 });
}
