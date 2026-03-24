/**
 * LGPD Art. 18 — Direito à Eliminação de Dados
 *
 * DELETE /api/workspace/gdpr
 *
 * Remove o workspace do usuário autenticado e todos os dados associados.
 * Apenas ADMINs podem invocar este endpoint.
 * O usuário deve confirmar a intenção digitando a string de confirmação.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

const CONFIRMATION_STRING = "DELETAR MINHA CONTA";

export async function DELETE(req: NextRequest) {
  // Rate limit — usa preset "auth" (10 req/min) para evitar brute-force
  const { ok } = await rateLimit(req, "auth");
  if (!ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde e tente novamente." },
      { status: 429 }
    );
  }

  // ── Autenticação e autorização ────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem solicitar a exclusão dos dados." },
      { status: 403 }
    );
  }

  const workspaceId = session.user.workspaceId as string;
  const userId = session.user.id as string;

  // ── Validação do corpo da requisição ─────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { confirm, password } = body as {
    confirm?: string;
    password?: string;
  };

  if (confirm !== CONFIRMATION_STRING) {
    return NextResponse.json(
      {
        error: `Para confirmar a exclusão, envie o campo "confirm" com o valor exato: "${CONFIRMATION_STRING}"`,
      },
      { status: 422 }
    );
  }

  // ── Verificação de senha (somente para usuários com credenciais) ───────────
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (user.passwordHash) {
    // Usuário com login por senha: exige confirmação
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Informe sua senha para confirmar a exclusão da conta." },
        { status: 422 }
      );
    }
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }
  }

  // ── Audit log ANTES da deleção (captura o registro de quem solicitou) ─────
  try {
    await createAuditLog({
      workspaceId,
      userId,
      action: "DELETE",
      resource: "workspace",
      resourceId: workspaceId,
      details: {
        reason: "LGPD Art. 18 — solicitação de eliminação de dados pelo titular",
        requestedBy: user.email,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Falha no audit log não impede a deleção — segue em frente
  }

  // ── Deleção do workspace e dados em cascata ───────────────────────────────
  try {
    // O Prisma aplica onDelete: Cascade em todas as relações do Workspace,
    // eliminando: members, integrations, campaigns, metrics, forecasts, alerts,
    // benchmarks, suggestions, reports, chatSessions, apiKeys, missions,
    // subscriptions e payments.
    await db.workspace.delete({ where: { id: workspaceId } });
  } catch (err) {
    console.error("[gdpr] Erro ao deletar workspace:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar a exclusão. Contate o suporte." },
      { status: 500 }
    );
  }

  // ── Verifica se o usuário pertence a outros workspaces ───────────────────
  const remainingMemberships = await db.workspaceMember.count({
    where: { userId },
  });

  // Se não há mais workspaces, anonimiza e exclui a conta do usuário
  if (remainingMemberships === 0) {
    try {
      // Anonimiza os campos PII antes de excluir para cobrir dados em logs/backups
      await db.user.update({
        where: { id: userId },
        data: {
          name: "[removido]",
          email: `deleted_${userId}@nufluma.invalid`,
          image: null,
          passwordHash: null,
        },
      });

      // Remove sessões e contas OAuth vinculadas (cascade já faz isso,
      // mas deletamos explicitamente para garantir a limpeza)
      await db.account.deleteMany({ where: { userId } });
      await db.session.deleteMany({ where: { userId } });

      // Deleta o usuário
      await db.user.delete({ where: { id: userId } });
    } catch (err) {
      // Anonimização falhou — conta ficará no banco com dados mascarados;
      // administradores podem limpar manualmente. Não é erro fatal.
      console.error("[gdpr] Erro ao anonimizar/deletar usuário:", err);
    }
  }

  return NextResponse.json(
    {
      success: true,
      message:
        "Seus dados foram excluídos conforme solicitado (LGPD Art. 18). " +
        "Você será desconectado automaticamente.",
    },
    { status: 200 }
  );
}
