import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { generateReportSchema } from "@/lib/validations";
import { generateNarrativeReport } from "@/services/ai-insights";

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req);
  if (!ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = generateReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { type, profile, periodStart, periodEnd } = parsed.data;
  const workspaceId = session.user.workspaceId as string;

  const report = await db.report.create({
    data: {
      workspaceId,
      type,
      profile,
      status: "GENERATING",
      title: `Relatório ${type === "MONTHLY" ? "Mensal" : type === "WEEKLY" ? "Semanal" : type === "QUARTERLY" ? "Trimestral" : "Personalizado"} — ${new Date(periodStart).toLocaleDateString("pt-BR")}`,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
    },
  });

  // Generate asynchronously
  (async () => {
    try {
      const content = await generateNarrativeReport(
        workspaceId,
        new Date(periodStart),
        new Date(periodEnd),
        profile
      );

      await db.report.update({
        where: { id: report.id },
        data: {
          status: "READY",
          content: { narrative: content },
          generatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[REPORTS] Generation failed", err);
      await db.report.update({
        where: { id: report.id },
        data: { status: "FAILED" },
      });
    }
  })();

  return NextResponse.json({ report }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await db.report.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ data: reports });
}
