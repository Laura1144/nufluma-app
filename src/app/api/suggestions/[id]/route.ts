import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["ACCEPTED", "DISCARDED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const suggestion = await db.suggestion.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  });
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.suggestion.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ data: updated });
}
