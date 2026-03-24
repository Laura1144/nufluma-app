import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inviteMemberSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { email, role } = parsed.data;

  const targetUser = await db.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json({ error: "Usuário não encontrado. O usuário precisa ter uma conta no Nufluma." }, { status: 404 });
  }

  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: session.user.workspaceId, userId: targetUser.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Usuário já é membro deste workspace." }, { status: 409 });
  }

  const member = await db.workspaceMember.create({
    data: {
      workspaceId: session.user.workspaceId,
      userId: targetUser.id,
      role,
      invitedBy: session.user.id,
      joinedAt: new Date(),
    },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  await createAuditLog({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: "INVITE",
    resource: "workspace_member",
    resourceId: member.id,
    details: { email, role },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json(member, { status: 201 });
}
