"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings, Users, Plug, Key, Scale,
  Copy, RefreshCw, Trash2, Plus, CheckCircle2, UserPlus
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Workspace, WorkspaceMember, Integration, ApiKey, User } from "@/types";

interface SettingsViewProps {
  workspace: Workspace;
  members: (WorkspaceMember & { user: Pick<User, "name" | "email" | "image"> })[];
  integrations: Integration[];
  apiKeys: ApiKey[];
  currentRole: string;
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-500/10 text-red-500 border-red-500/20",
  MANAGER: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  ANALYST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  VIEWER: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const integrationLabels: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  GOOGLE_ANALYTICS: "Google Analytics",
  CSV_IMPORT: "Import CSV",
  API: "API",
};

const integrationStatusColor: Record<string, string> = {
  CONNECTED: "text-green-500",
  DISCONNECTED: "text-muted-foreground",
  ERROR: "text-red-500",
  PENDING: "text-yellow-500",
};

export function SettingsView({
  workspace,
  members,
  integrations,
  apiKeys,
  currentRole,
}: SettingsViewProps) {
  const router = useRouter();
  const [weights, setWeights] = useState(
    (workspace.scoreWeights as Record<string, number>) ?? {
      ctr: 0.2, cpc: 0.2, cpl: 0.2, conversion: 0.2, roas: 0.2,
    }
  );
  const [savingWeights, setSavingWeights] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MANAGER" | "ANALYST" | "VIEWER">("ANALYST");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canAdmin = currentRole === "ADMIN";
  const canManage = canAdmin || currentRole === "MANAGER";

  const saveWeights = async () => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.01) {
      toast.error("Os pesos devem somar 1.0");
      return;
    }
    setSavingWeights(true);
    try {
      const res = await fetch("/api/settings/score-weights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      if (res.ok) toast.success("Pesos salvos com sucesso!");
      else throw new Error();
    } catch {
      toast.error("Erro ao salvar pesos");
    } finally {
      setSavingWeights(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.user.name ?? inviteEmail} adicionado ao workspace!`);
        setInviteEmail("");
        router.refresh();
      } else {
        toast.error(data.error ?? "Erro ao convidar membro");
      }
    } catch {
      toast.error("Erro ao convidar membro");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/workspace/members/${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${memberName} removido do workspace.`);
        router.refresh();
      } else {
        toast.error(data.error ?? "Erro ao remover membro");
      }
    } catch {
      toast.error("Erro ao remover membro");
    } finally {
      setRemovingId(null);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedKey(data.key);
        setNewKeyName("");
        toast.success("API Key gerada! Copie agora — ela não será mostrada novamente.");
      }
    } catch {
      toast.error("Erro ao criar API key");
    }
  };

  return (
    <Tabs defaultValue="workspace">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="workspace" className="gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" /> Workspace
        </TabsTrigger>
        <TabsTrigger value="score" className="gap-1.5 text-xs">
          <Scale className="h-3.5 w-3.5" /> Pesos do Score
        </TabsTrigger>
        <TabsTrigger value="members" className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" /> Membros
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-1.5 text-xs">
          <Plug className="h-3.5 w-3.5" /> Integrações
        </TabsTrigger>
        <TabsTrigger value="api-keys" className="gap-1.5 text-xs">
          <Key className="h-3.5 w-3.5" /> API Keys
        </TabsTrigger>
      </TabsList>

      {/* ─── Workspace ─────────────────────────────────────────────────────── */}
      <TabsContent value="workspace" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input defaultValue={workspace.name} disabled={!canAdmin} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input defaultValue={workspace.slug} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Input defaultValue={workspace.industry ?? ""} disabled={!canAdmin} />
              </div>
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{workspace.plan}</Badge>
                </div>
              </div>
            </div>
            {canAdmin && <Button>Salvar alterações</Button>}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Score Weights ─────────────────────────────────────────────────── */}
      <TabsContent value="score" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pesos do Health Score</CardTitle>
            <CardDescription>
              Configure a importância de cada métrica. Total deve somar 1.0
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(weights).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="capitalize">{key}</Label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={value}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled={!canManage}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <p className={`text-sm ${Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 0.01 ? "text-green-500" : "text-red-500"}`}>
                Total: {Object.values(weights).reduce((a, b) => a + b, 0).toFixed(2)}
              </p>
              {canManage && (
                <Button onClick={saveWeights} disabled={savingWeights} size="sm">
                  {savingWeights ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Salvar pesos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Members ───────────────────────────────────────────────────────── */}
      <TabsContent value="members" className="mt-6 space-y-4">
        {/* Invite form */}
        {canAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Convidar Membro
              </CardTitle>
              <CardDescription>
                O usuário precisa ter uma conta no Nufluma para ser adicionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="email@exemplo.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                  className="flex-1"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="ANALYST">Analyst</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={inviteMember}
                  disabled={!inviteEmail.trim() || inviting}
                  className="gap-1.5 shrink-0"
                >
                  {inviting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros do Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.user.image ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {m.user.name?.charAt(0) ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${roleColors[m.role] ?? ""}`}
                  >
                    {m.role}
                  </Badge>
                  {canAdmin && m.role !== "ADMIN" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={removingId === m.id}
                      onClick={() => removeMember(m.id, m.user.name ?? m.user.email ?? "")}
                    >
                      {removingId === m.id
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ─── Integrations ──────────────────────────────────────────────────── */}
      <TabsContent value="integrations" className="mt-6">
        <div className="space-y-3">
          {(["GOOGLE_ADS", "META_ADS", "GOOGLE_ANALYTICS", "CSV_IMPORT"] as const).map((type) => {
            const existing = integrations.find((i) => i.type === type);
            return (
              <Card key={type}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg">
                    {type === "GOOGLE_ADS" ? "G" : type === "META_ADS" ? "M" : type === "GOOGLE_ANALYTICS" ? "📊" : "📄"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{integrationLabels[type]}</p>
                    {existing ? (
                      <p className={`text-xs ${integrationStatusColor[existing.status]}`}>
                        {existing.status} — {existing.lastSyncAt ? `Sincronizado ${new Date(existing.lastSyncAt).toLocaleDateString("pt-BR")}` : "Nunca sincronizado"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Não conectado</p>
                    )}
                  </div>
                  {canManage && (
                    <Button size="sm" variant={existing ? "outline" : "default"}>
                      {existing ? "Reconectar" : "Conectar"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      {/* ─── API Keys ──────────────────────────────────────────────────────── */}
      <TabsContent value="api-keys" className="mt-6 space-y-4">
        {generatedKey && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-500 mb-1">
                    Chave gerada — copie agora!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-1.5 text-xs font-mono break-all">
                      {generatedKey}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKey);
                        toast.success("Copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova API Key</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da chave (ex: n8n-production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={createApiKey} disabled={!newKeyName.trim()} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {apiKeys.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {k.keyPrefix}••••••••
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {k.lastUsedAt
                    ? `Usado ${new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}`
                    : "Nunca usado"}
                </div>
                {canAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {apiKeys.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma API key ativa
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
