import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { AlertCenter } from "@/components/alerts/alert-center";

export const metadata: Metadata = { title: "Central de Alertas" };

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const alerts = await db.alert.findMany({
    where: { workspaceId },
    include: { campaign: { select: { name: true, channel: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = {
    active: alerts.filter((a) => a.status === "ACTIVE").length,
    acknowledged: alerts.filter((a) => a.status === "ACKNOWLEDGED").length,
    resolved: alerts.filter((a) => a.status === "RESOLVED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Alertas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitoramento automático de métricas críticas
        </p>
      </div>
      <AlertCenter alerts={alerts} counts={counts} />
    </div>
  );
}
