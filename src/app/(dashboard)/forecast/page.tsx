import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { ForecastView } from "@/components/forecast/forecast-view";

export const metadata: Metadata = { title: "Forecast Preditivo" };

export default async function ForecastPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const campaigns = await db.campaign.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { id: true, name: true, channel: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forecast Preditivo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Previsões de leads, conversões e investimento com intervalo de confiança
        </p>
      </div>
      <ForecastView campaigns={campaigns} workspaceId={workspaceId} />
    </div>
  );
}
