import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const alert = await db.alert.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  });

  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  if (alert.status !== "ACTIVE") return NextResponse.json({ error: "Alert is not active" }, { status: 409 });

  const updated = await db.alert.update({
    where: { id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedBy: session.user.id,
    },
  });

  await createAuditLog({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: "UPDATE",
    resource: "alert",
    resourceId: id,
    details: { action: "acknowledge" },
  });

  return NextResponse.json({ data: updated });
}
