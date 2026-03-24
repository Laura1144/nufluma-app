import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Precisa de ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Precisa de ao menos um número"),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  industry: z.string().optional(),
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(2).max(200),
  channel: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "ENDED", "DRAFT"]).optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  integrationId: z.string().optional(),
});

// ─── Metrics ──────────────────────────────────────────────────────────────────
export const ingestMetricsSchema = z.object({
  campaignId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  impressions: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  leads: z.number().int().nonnegative().optional(),
  conversions: z.number().int().nonnegative().optional(),
  spend: z.number().nonnegative().optional(),
  revenue: z.number().nonnegative().optional(),
  source: z.string().optional(),
});

export const batchIngestSchema = z.object({
  metrics: z.array(ingestMetricsSchema).min(1).max(1000),
});

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertRuleSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum([
    "COST_PER_LEAD_SPIKE",
    "CTR_DROP",
    "CONVERSION_DROP",
    "BUDGET_DEPLETED",
    "ROAS_DROP",
    "CUSTOM",
  ]),
  metric: z.string().min(1),
  condition: z.enum(["gt", "lt", "gte", "lte", "eq"]),
  threshold: z.number(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  channels: z.array(z.string()).optional(),
});

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1),
});

// ─── Reports ──────────────────────────────────────────────────────────────────
export const generateReportSchema = z.object({
  type: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "CUSTOM"]),
  profile: z.enum(["MANAGER", "TECHNICAL"]).default("MANAGER"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const scoreWeightsSchema = z
  .object({
    ctr: z.number().min(0).max(1),
    cpc: z.number().min(0).max(1),
    cpl: z.number().min(0).max(1),
    conversion: z.number().min(0).max(1),
    roas: z.number().min(0).max(1),
  })
  .refine(
    (data) => {
      const sum = Object.values(data).reduce((a, b) => a + b, 0);
      return Math.abs(sum - 1) < 0.01;
    },
    { message: "Os pesos devem somar 1.0" }
  );

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "ANALYST", "VIEWER"]),
});

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(100),
  expiresAt: z.string().datetime().optional(),
});

// ─── Webhooks ─────────────────────────────────────────────────────────────────
export const webhookIngestSchema = z.object({
  workspaceId: z.string().min(1),
  source: z.enum(["google_ads", "meta_ads", "csv", "n8n", "custom"]),
  data: z.array(ingestMetricsSchema),
});
