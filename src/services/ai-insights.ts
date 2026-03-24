import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export async function generateCausalInsight(
  workspaceId: string,
  campaignId?: string,
  period = "30d"
): Promise<string> {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const metrics = await db.metric.findMany({
    where: {
      workspaceId,
      ...(campaignId ? { campaignId } : {}),
      date: { gte: since },
    },
    include: { campaign: true },
    orderBy: { date: "asc" },
  });

  if (metrics.length === 0) {
    return "Dados insuficientes para análise. Importe métricas para obter insights.";
  }

  // Aggregate by channel
  const byChannel = metrics.reduce(
    (acc, m) => {
      const ch = m.campaign?.channel ?? "unknown";
      if (!acc[ch]) acc[ch] = { spend: 0, leads: 0, clicks: 0, impressions: 0, revenue: 0 };
      acc[ch].spend += m.spend ?? 0;
      acc[ch].leads += m.leads ?? 0;
      acc[ch].clicks += m.clicks ?? 0;
      acc[ch].impressions += m.impressions ?? 0;
      acc[ch].revenue += m.revenue ?? 0;
      return acc;
    },
    {} as Record<string, { spend: number; leads: number; clicks: number; impressions: number; revenue: number }>
  );

  const summary = Object.entries(byChannel)
    .map(([ch, data]) => {
      const ctr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : "N/A";
      const cpl = data.leads > 0 ? (data.spend / data.leads).toFixed(2) : "N/A";
      const roas = data.spend > 0 ? (data.revenue / data.spend).toFixed(2) : "N/A";
      return `Canal: ${ch} | Investimento: R$${data.spend.toFixed(2)} | Leads: ${data.leads} | CTR: ${ctr}% | CPL: R$${cpl} | ROAS: ${roas}x`;
    })
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.3,
    system: `Você é um consultor de marketing digital especializado em performance de campanhas.
Analise os dados fornecidos e forneça uma análise causal objetiva e acionável.
Estruture sua resposta em:
1. O que aconteceu (fatos principais)
2. Por que aconteceu (causas prováveis com nível de confiança)
3. Recomendações imediatas (máximo 3 ações concretas)

Seja objetivo, cite métricas específicas e nunca invente dados que não foram fornecidos.`,
    messages: [
      {
        role: "user",
        content: `Analise a performance das campanhas nos últimos ${days} dias:\n\n${summary}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "Não foi possível gerar análise.";
}

export async function generateCreativeSuggestions(
  workspaceId: string,
  campaignId: string
): Promise<{ type: string; title: string; content: string; rationale: string }[]> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      metrics: {
        orderBy: { date: "desc" },
        take: 30,
      },
    },
  });

  if (!campaign) return [];

  const avgCtr =
    campaign.metrics.reduce((a, m) => a + (m.ctr ?? 0), 0) /
    Math.max(1, campaign.metrics.length);

  const prompt = `Campanha: ${campaign.name} | Canal: ${campaign.channel} | CTR médio: ${avgCtr.toFixed(2)}%

Gere 3 sugestões criativas específicas para melhorar a performance desta campanha.
Responda em JSON válido com a estrutura: { "suggestions": [ { "type": "COPY|CTA|CREATIVE|ANGLE", "title": "...", "content": "...", "rationale": "..." } ] }`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0.7,
    system: "Você é um especialista em marketing de performance e copywriting. Responda apenas com JSON válido, sem markdown, sem explicações extras.",
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const block = response.content[0];
    const text = block.type === "text" ? block.text : "{}";
    const parsed = JSON.parse(text);
    return parsed.suggestions ?? parsed.items ?? [];
  } catch {
    return [];
  }
}

export async function chatWithData(
  workspaceId: string,
  question: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ content: string; data?: unknown }> {
  // Fetch recent context
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [campaigns, recentMetrics] = await Promise.all([
    db.campaign.findMany({
      where: { workspaceId },
      select: { id: true, name: true, channel: true, status: true },
    }),
    db.metric.findMany({
      where: { workspaceId, date: { gte: since } },
      include: { campaign: { select: { name: true, channel: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  const context = `
Workspace tem ${campaigns.length} campanhas: ${campaigns.map((c) => `${c.name} (${c.channel})`).join(", ")}.
Últimas métricas disponíveis (${recentMetrics.length} registros nos últimos 30 dias).
`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
    { role: "user", content: question },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.2,
    system: `Você é o Consultor Nufluma — um assistente especializado em analytics de marketing digital.
Responda perguntas sobre campanhas usando os dados reais fornecidos.
IMPORTANTE: Nunca invente números. Se o dado não estiver disponível, diga claramente.
Se a pergunta precisar de dados adicionais, peça permissão para buscá-los.
Contexto do workspace: ${context}`,
    messages,
  });

  const block = response.content[0];
  return {
    content: block.type === "text" ? block.text : "Não consegui processar sua pergunta.",
  };
}

export async function chatSupport(
  history: { role: "user" | "assistant"; content: string }[],
  question: string
): Promise<{ content: string; shouldEscalate: boolean }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    temperature: 0.3,
    system: `Você é o agente de suporte da Nufluma, uma plataforma SaaS de analytics de marketing digital.
Você pode ajudar com: navegação no dashboard, entendimento de métricas (CTR, CPL, ROAS, CPC),
configuração de campanhas, integrações, relatórios, alertas, benchmarks e uso geral da plataforma.

Quando a questão envolver: reembolso, cancelamento de plano, bug técnico grave, conta bloqueada,
problemas de acesso, faturamento ou qualquer situação que exija intervenção manual de um humano —
responda normalmente explicando que irá acionar um atendente, MAS inicie sua resposta com [ESCALAR].

Exemplos de tópicos que devem gerar [ESCALAR]: "quero cancelar", "não consigo acessar minha conta",
"cobrado errado", "reembolso", "meu plano não ativou", "preciso falar com alguém".

Seja direto, cordial e use português brasileiro. Respostas curtas e objetivas.`,
    messages: [
      ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.MessageParam),
      { role: "user", content: question },
    ],
  });

  const block = response.content[0];
  const raw = block.type === "text" ? block.text : "Não consegui processar sua mensagem. Tente novamente.";
  const shouldEscalate = raw.trimStart().startsWith("[ESCALAR]");
  const content = shouldEscalate ? raw.replace(/^\[ESCALAR\]\s*/i, "").trim() : raw;

  return { content, shouldEscalate };
}

export async function generateNarrativeReport(
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
  profile: "MANAGER" | "TECHNICAL"
): Promise<string> {
  const metrics = await db.metric.findMany({
    where: {
      workspaceId,
      date: { gte: periodStart, lte: periodEnd },
    },
    include: { campaign: true },
  });

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + (m.spend ?? 0),
      leads: acc.leads + (m.leads ?? 0),
      conversions: acc.conversions + (m.conversions ?? 0),
      revenue: acc.revenue + (m.revenue ?? 0),
      clicks: acc.clicks + (m.clicks ?? 0),
    }),
    { spend: 0, leads: 0, conversions: 0, revenue: 0, clicks: 0 }
  );

  const profileInstructions =
    profile === "MANAGER"
      ? "Escreva em linguagem executiva, focando em resultados de negócio e ROI. Evite jargões técnicos."
      : "Escreva com detalhes técnicos, incluindo métricas granulares, análise de funil e recomendações de otimização.";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.4,
    system: `Você é um analista de marketing sênior gerando um relatório narrativo. ${profileInstructions}`,
    messages: [
      {
        role: "user",
        content: `Gere um relatório para o período ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}.
Dados: Investimento total: R$${totals.spend.toFixed(2)} | Leads: ${totals.leads} | Conversões: ${totals.conversions} | Receita: R$${totals.revenue.toFixed(2)} | Cliques: ${totals.clicks}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "Relatório não disponível.";
}
