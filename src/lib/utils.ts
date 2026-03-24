import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1) {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
}

export function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function generateApiKey() {
  const key = crypto.randomBytes(32).toString("hex");
  const prefix = "nfm_";
  return `${prefix}${key}`;
}

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateWebhookSignature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const expected = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

export function getScoreColor(score: number) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getScoreLabel(score: number) {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Regular";
  return "Crítico";
}

export function getSeverityColor(severity: string) {
  const map: Record<string, string> = {
    CRITICAL: "text-red-500 bg-red-500/10 border-red-500/20",
    HIGH: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    MEDIUM: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    LOW: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  };
  return map[severity] ?? map.LOW;
}

export function getChannelIcon(channel: string) {
  const map: Record<string, string> = {
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    email: "E-mail",
    organic: "Orgânico",
  };
  return map[channel.toLowerCase()] ?? channel;
}

export function calculateDerivedMetrics(raw: {
  impressions?: number;
  clicks?: number;
  leads?: number;
  conversions?: number;
  spend?: number;
  revenue?: number;
}) {
  const { impressions, clicks, leads, conversions, spend, revenue } = raw;

  return {
    ctr: impressions && clicks ? (clicks / impressions) * 100 : null,
    cpc: clicks && spend ? spend / clicks : null,
    cpl: leads && spend ? spend / leads : null,
    cpa: conversions && spend ? spend / conversions : null,
    roas: spend && revenue ? revenue / spend : null,
    convRate: clicks && conversions ? (conversions / clicks) * 100 : null,
  };
}

export function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(cpf[10]);
}

export function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDigit = (str: string, weights: number[]) => {
    const sum = str.split("").reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    calcDigit(cnpj.slice(0, 12), w1) === parseInt(cnpj[12]) &&
    calcDigit(cnpj.slice(0, 13), w2) === parseInt(cnpj[13])
  );
}

export function dateRange(period: "7d" | "30d" | "90d" | "1y") {
  const end = new Date();
  const start = new Date();
  const map = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  start.setDate(end.getDate() - map[period]);
  return { start, end };
}
