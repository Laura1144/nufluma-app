import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { SuggestionsView } from "@/components/suggestions/suggestions-view";

export const metadata: Metadata = { title: "Sugestões Criativas" };

export default async function SuggestionsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;

  const [suggestions, campaigns] = await Promise.all([
    db.suggestion.findMany({
      where: { workspaceId },
      include: { campaign: { select: { name: true, channel: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.campaign.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, name: true, channel: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sugestões Criativas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Copy, CTA e recomendações de criativo geradas por IA
        </p>
      </div>
      <SuggestionsView suggestions={suggestions} campaigns={campaigns} />
    </div>
  );
}
