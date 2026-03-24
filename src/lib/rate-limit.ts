import { redis } from "./redis";
import { NextRequest } from "next/server";

interface RateLimitConfig {
  requests: number;
  window: number; // seconds
}

const presets = {
  api:     { requests: 100, window: 60 }, // 100 req/min — endpoints REST gerais
  auth:    { requests: 10,  window: 60 }, // 10 tentativas de login por minuto por IP
  webhook: { requests: 500, window: 60 }, // 500 req/min — ingestão de métricas via n8n
  chat:    { requests: 20,  window: 60 }, // 20 mensagens/min ao Consultor IA
};

export async function rateLimit(
  request: NextRequest,
  preset: keyof typeof presets = "api"
) {
  const config = presets[preset];
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `rl:${preset}:${ip}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, config.window);
    }

    const remaining = Math.max(0, config.requests - current);
    const reset = await redis.ttl(key);

    return {
      ok: current <= config.requests,
      remaining,
      reset,
      limit: config.requests,
    };
  } catch {
    // Redis indisponível — permite a requisição (sem rate limiting)
    return { ok: true, remaining: config.requests, reset: config.window, limit: config.requests };
  }
}

export function rateLimitHeaders(result: Awaited<ReturnType<typeof rateLimit>>) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}
