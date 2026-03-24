import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { chatSupport } from "@/services/ai-insights";
import { SUPPORT_WEBHOOK_URL } from "@/lib/constants";

// ── Webhook n8n (fire-and-forget com 3 tentativas) ────────────────────────────

async function notifyN8n(payload: Record<string, unknown>) {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(SUPPORT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return;
      console.warn(`[support/chat] n8n retornou ${res.status} (tentativa ${attempt}/${MAX_ATTEMPTS})`);
    } catch (err) {
      console.error(`[support/chat] Erro ao notificar n8n (tentativa ${attempt}/${MAX_ATTEMPTS}):`, err);
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  console.error("[support/chat] Todas as tentativas de notificação ao n8n falharam.");
}

// ── POST /api/support/chat ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req, "chat");
  if (!ok) {
    return NextResponse.json({ error: "Muitas mensagens. Aguarde um momento." }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = session.user.workspaceId as string;
  const userId = session.user.id as string;
  const userName = session.user.name ?? "Usuário";
  const userEmail = session.user.email ?? "";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { message, sessionId, escalate } = body as {
    message?: string;
    sessionId?: string;
    escalate?: boolean;
  };

  // Escalação manual (sem mensagem) — aciona o atendente diretamente
  if (escalate && !message) {
    const supportSession = sessionId
      ? await db.supportSession.findFirst({ where: { id: sessionId, workspaceId } })
      : null;

    if (supportSession && supportSession.status !== "ESCALATED") {
      await db.supportSession.update({
        where: { id: supportSession.id },
        data: { status: "ESCALATED", escalatedAt: new Date(), updatedAt: new Date() },
      });
    }

    const recentMessages = supportSession
      ? await db.supportMessage.findMany({
          where: { sessionId: supportSession.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [];

    const conversation = recentMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    ;(async () => {
      await notifyN8n({
        event: "support_escalation",
        session_id: supportSession?.id ?? null,
        workspace_id: workspaceId,
        user: { name: userName, email: userEmail },
        reason: "user_requested",
        conversation,
      });
    })();

    return NextResponse.json({
      content: null,
      sessionId: supportSession?.id ?? null,
      escalated: true,
    });
  }

  // Validação da mensagem
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 422 });
  }

  const trimmedMessage = message.trim().slice(0, 4000);

  // ── Cria ou recupera a sessão de suporte ─────────────────────────────────
  let supportSession = sessionId
    ? await db.supportSession.findFirst({ where: { id: sessionId, workspaceId } })
    : null;

  if (!supportSession) {
    supportSession = await db.supportSession.create({
      data: { workspaceId, userId },
    });
  }

  // Busca histórico de mensagens para contexto da IA (últimas 10)
  const historyRecords = await db.supportMessage.findMany({
    where: { sessionId: supportSession.id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history = historyRecords.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // ── Chama a IA ────────────────────────────────────────────────────────────
  let aiContent: string;
  let shouldEscalate: boolean;

  try {
    const result = await chatSupport(history, trimmedMessage);
    aiContent = result.content;
    shouldEscalate = result.shouldEscalate || (escalate === true);
  } catch (err) {
    console.error("[support/chat] Erro ao chamar IA:", err);
    aiContent = "Estou com dificuldades técnicas no momento. Você pode tentar novamente ou clicar em \"Falar com atendente\" para contato humano.";
    shouldEscalate = false;
  }

  // ── Persiste as mensagens ─────────────────────────────────────────────────
  await db.supportMessage.createMany({
    data: [
      { sessionId: supportSession.id, role: "user", content: trimmedMessage },
      { sessionId: supportSession.id, role: "assistant", content: aiContent },
    ],
  });

  await db.supportSession.update({
    where: { id: supportSession.id },
    data: { updatedAt: new Date() },
  });

  // ── Escalação (automática ou solicitada junto com mensagem) ───────────────
  if (shouldEscalate && supportSession.status !== "ESCALATED") {
    await db.supportSession.update({
      where: { id: supportSession.id },
      data: { status: "ESCALATED", escalatedAt: new Date(), updatedAt: new Date() },
    });

    const conversation = [
      ...history,
      { role: "user", content: trimmedMessage },
      { role: "assistant", content: aiContent },
    ];

    ;(async () => {
      await notifyN8n({
        event: "support_escalation",
        session_id: supportSession!.id,
        workspace_id: workspaceId,
        user: { name: userName, email: userEmail },
        reason: "ai_suggested",
        conversation,
      });
    })();
  }

  return NextResponse.json({
    content: aiContent,
    sessionId: supportSession.id,
    escalated: shouldEscalate || supportSession.status === "ESCALATED",
  });
}
