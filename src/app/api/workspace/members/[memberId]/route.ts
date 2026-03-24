import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["MANAGER", "ANALYST", "VIEWER"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId } = await params;

  const member = await db.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: session.user.workspaceId },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  if (member.userId === session.user.id) {
    return NextResponse.json({ error: "Você não pode alterar seu próprio role." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updated = await db.workspaceMember.update({
    where: { id: memberId },
    data: { role: parsed.data.role },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  await createAuditLog({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: "PERMISSION_CHANGE",
    resource: "workspace_member",
    resourceId: memberId,
    details: { previousRole: member.role, newRole: parsed.data.role },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberId } = await params;

  const member = await db.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: session.user.workspaceId },
  });
  if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

  if (member.userId === session.user.id) {
    return NextResponse.json({ error: "Você não pode remover a si mesmo do workspace." }, { status: 400 });
  }

  if (member.role === "ADMIN") {
    const adminCount = await db.workspaceMember.count({
      where: { workspaceId: session.user.workspaceId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Não é possível remover o último ADMIN do workspace." }, { status: 400 });
    }
  }

  await db.workspaceMember.delete({ where: { id: memberId } });

  await createAuditLog({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: "DELETE",
    resource: "workspace_member",
    resourceId: memberId,
    details: { removedUserId: member.userId, role: member.role },
  });

  return NextResponse.json({ success: true });
}
