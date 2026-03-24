import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreWeightsSchema } from "@/lib/validations";
import { invalidateCache } from "@/lib/redis";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = ["ADMIN", "MANAGER"].includes(session.user.role ?? "");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = scoreWeightsSchema.safeParse(body.weights);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  await db.workspace.update({
    where: { id: session.user.workspaceId },
    data: { scoreWeights: parsed.data },
  });

  await invalidateCache(`hs:${session.user.workspaceId}:*`);

  return NextResponse.json({ success: true });
}
