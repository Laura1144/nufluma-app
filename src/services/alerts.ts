import { db } from "@/lib/db";
import { AlertType, AlertSeverity } from "@prisma/client";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function checkAndFireAlerts(workspaceId: string) {
  const rules = await db.alertRule.findMany({
    where: { workspaceId, enabled: true },
  });

  if (rules.length === 0) return;

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const metrics = await db.metric.findMany({
    where: { workspaceId, date: { gte: since } },
    include: { campaign: true },
  });

  if (metrics.length === 0) return;

  // Aggregate last 7 days
  const aggregated = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + (m.spend ?? 0),
      leads: acc.leads + (m.leads ?? 0),
      clicks: acc.clicks + (m.clicks ?? 0),
      impressions: acc.impressions + (m.impressions ?? 0),
      conversions: acc.conversions + (m.conversions ?? 0),
    }),
    { spend: 0, leads: 0, clicks: 0, impressions: 0, conversions: 0 }
  );

  const derived = {
    cpl: aggregated.leads > 0 ? aggregated.spend / aggregated.leads : Infinity,
    ctr:
      aggregated.impressions > 0
        ? (aggregated.clicks / aggregated.impressions) * 100
        : 0,
    conv_rate:
      aggregated.clicks > 0
        ? (aggregated.conversions / aggregated.clicks) * 100
        : 0,
  };

  for (const rule of rules) {
    const value = (derived as Record<string, number>)[rule.metric];
    if (value === undefined) continue;

    let triggered = false;
    switch (rule.condition) {
      case "gt": triggered = value > rule.threshold; break;
      case "lt": triggered = value < rule.threshold; break;
      case "gte": triggered = value >= rule.threshold; break;
      case "lte": triggered = value <= rule.threshold; break;
      case "eq": triggered = value === rule.threshold; break;
    }

    if (!triggered) continue;

    // Check if alert already active to avoid spam
    const existing = await db.alert.findFirst({
      where: {
        workspaceId,
        type: rule.type as AlertType,
        status: "ACTIVE",
        createdAt: { gte: since },
      },
    });

    if (existing) continue;

    const alert = await db.alert.create({
      data: {
        workspaceId,
        type: rule.type as AlertType,
        severity: rule.severity as AlertSeverity,
        title: rule.name,
        message: generateAlertMessage(rule.metric, value, rule.threshold, rule.condition),
        metric: rule.metric,
        threshold: rule.threshold,
        currentValue: value,
        notifiedVia: [],
      },
    });

    // Notify via configured channels
    if (rule.channels.includes("email")) {
      await sendEmailAlert(workspaceId, alert.id, alert.title, alert.message);
    }
    if (rule.channels.includes("n8n")) {
      await triggerN8nAlert(workspaceId, alert);
    }
  }
}

function generateAlertMessage(
  metric: string,
  value: number,
  threshold: number,
  condition: string
): string {
  const labels: Record<string, string> = {
    cpl: "Custo por Lead",
    ctr: "Taxa de Clique (CTR)",
    conv_rate: "Taxa de Conversão",
  };

  const label = labels[metric] ?? metric;
  const formattedValue = metric === "cpl" ? `R$${value.toFixed(2)}` : `${value.toFixed(2)}%`;
  const formattedThreshold = metric === "cpl" ? `R$${threshold.toFixed(2)}` : `${threshold.toFixed(2)}%`;

  return `${label} atingiu ${formattedValue} (limite: ${formattedThreshold}). Verificação recomendada.`;
}

async function sendEmailAlert(
  workspaceId: string,
  alertId: string,
  title: string,
  message: string
) {
  try {
    const members = await db.workspaceMember.findMany({
      where: { workspaceId, role: { in: ["ADMIN", "MANAGER"] } },
      include: { user: { select: { email: true, name: true } } },
    });

    for (const member of members) {
      if (!member.user.email) continue;
      await transporter.sendMail({
        from: `Nufluma Alerts <${process.env.SMTP_FROM}>`,
        to: member.user.email,
        subject: `⚠️ Alerta Nufluma: ${title}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#F40202;padding:20px;border-radius:8px 8px 0 0">
              <h1 style="color:white;margin:0;font-size:20px">⚠️ ${title}</h1>
            </div>
            <div style="background:#1a1a1a;padding:24px;color:#f1f1f1">
              <p>${message}</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/alerts"
                 style="background:#F40202;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
                Ver Central de Alertas
              </a>
            </div>
          </div>
        `,
      });
    }

    await db.alert.update({
      where: { id: alertId },
      data: { notifiedVia: { push: "email" } },
    });
  } catch (err) {
    console.error("[ALERTS] Failed to send email", err);
  }
}

async function triggerN8nAlert(workspaceId: string, alert: { id: string; title: string; message: string; severity: string }) {
  if (!process.env.N8N_BASE_URL) return;
  try {
    await fetch(`${process.env.N8N_BASE_URL}/webhook/nufluma-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.N8N_API_KEY}`,
      },
      body: JSON.stringify({ workspaceId, alert }),
    });
  } catch (err) {
    console.error("[ALERTS] Failed to trigger n8n", err);
  }
}
