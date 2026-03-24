import type {
  User,
  Workspace,
  WorkspaceMember,
  Campaign,
  Metric,
  Alert,
  Forecast,
  Suggestion,
  Report,
  Benchmark,
  Mission,
  Integration,
  ApiKey,
  Role,
  AlertSeverity,
  AlertStatus,
  AlertType,
  CampaignStatus,
} from "@prisma/client";

export type {
  User,
  Workspace,
  WorkspaceMember,
  Campaign,
  Metric,
  Alert,
  Forecast,
  Suggestion,
  Report,
  Benchmark,
  Mission,
  Integration,
  ApiKey,
  Role,
  AlertSeverity,
  AlertStatus,
  AlertType,
  CampaignStatus,
};

// ─── Extended types ────────────────────────────────────────────────────────────

export type CampaignWithMetrics = Campaign & {
  metrics: Metric[];
  latestScore?: number;
};

export type AlertWithCampaign = Alert & {
  campaign: Campaign | null;
};

export type DashboardKPIs = {
  totalSpend: number;
  totalLeads: number;
  avgCPL: number;
  avgCTR: number;
  avgROAS: number;
  totalConversions: number;
  spendTrend: number;
  leadsTrend: number;
  cplTrend: number;
  ctrTrend: number;
};

export type HealthScoreData = {
  campaignId: string;
  campaignName: string;
  channel: string;
  score: number;
  explanation: string;
  breakdown: {
    metric: string;
    label: string;
    value: number;
    weight: number;
    score: number;
  }[];
};

export type ForecastDataPoint = {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  actual?: number;
};

export type BenchmarkComparison = {
  metric: string;
  label: string;
  clientValue: number;
  industryAvg: number;
  percentile: number;
  status: "above" | "average" | "below";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  metadata?: {
    data?: unknown;
    chartType?: string;
  };
};

export type Period = "7d" | "30d" | "90d" | "1y";

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ScoreWeights = {
  ctr: number;
  cpc: number;
  cpl: number;
  conversion: number;
  roas: number;
};
