import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWorkspaceSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createWorkspaceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { name, industry } = parsed.data;

  // Generate unique slug
  let slug = slugify(name);
  const existing = await db.workspace.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const workspace = await db.workspace.create({
    data: {
      name,
      slug,
      industry,
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
          joinedAt: new Date(),
        },
      },
    },
  });

  return NextResponse.json({ workspaceId: workspace.id, slug: workspace.slug }, { status: 201 });
}
