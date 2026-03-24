import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) redirect("/login");
  const workspaceId = session.user.workspaceId;
  const userId = session.user.id;

  const [workspace, members, integrations, apiKeys] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.integration.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    db.apiKey.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currentMember = members.find((m) => m.userId === userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie workspace, integrações, permissões e API keys
        </p>
      </div>
      <SettingsView
        workspace={workspace!}
        members={members}
        integrations={integrations}
        apiKeys={apiKeys}
        currentRole={currentMember?.role ?? "VIEWER"}
      />
    </div>
  );
}
