/** Preço do plano Pro em centavos — usado pelo Pagar.me */
export const PLAN_PRICE_CENTS = 16990;

/** Preço do plano Pro formatado em BRL — usado em payloads e notificações */
export const PLAN_PRICE_BRL = "R$ 169,90";

/** Dias de trial concedidos ao novo cliente após confirmação de pagamento */
export const TRIAL_DAYS = 7;

/** URL do webhook n8n para acionar atendente de suporte */
export const SUPPORT_WEBHOOK_URL = "https://n8n.lenddev.com/webhook/chama-suporte-nufluma";

/**
 * Benchmarks médios de indústria usados na página de comparação.
 * Fonte: estimativas internas baseadas em dados de mercado brasileiro.
 */
export const INDUSTRY_BENCHMARKS = {
  ctr:      { avg: 2.35, label: "CTR",                format: "percent" },
  cpc:      { avg: 2.80, label: "CPC",                format: "currency" },
  cpl:      { avg: 45.0, label: "CPL",                format: "currency" },
  roas:     { avg: 4.2,  label: "ROAS",               format: "multiplier" },
  convRate: { avg: 3.1,  label: "Taxa de Conversão",  format: "percent" },
} as const;
