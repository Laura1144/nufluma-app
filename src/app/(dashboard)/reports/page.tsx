import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const reports = await db.report.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Relatórios narrativos personalizados em PDF com análise de IA
        </p>
      </div>
      <ReportsView reports={reports} />
    </div>
  );
}
