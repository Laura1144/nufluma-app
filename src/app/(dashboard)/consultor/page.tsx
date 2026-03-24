import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { ChatInterface } from "@/components/consultor/chat-interface";

export const metadata: Metadata = { title: "Consultor IA" };

export default async function ConsultorPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;
  const userId = session.user.id;

  // Load recent sessions
  const sessions = await db.chatSession.findMany({
    where: { workspaceId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Consultor IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chat com seus dados de marketing — powered by GPT-4o
        </p>
      </div>
      <ChatInterface sessions={sessions} workspaceId={workspaceId} />
    </div>
  );
}
