import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Cache helpers
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const data = await fn();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}

export const CACHE_KEYS = {
  healthScore: (workspaceId: string, campaignId?: string) =>
    `hs:${workspaceId}:${campaignId ?? "all"}`,
  campaigns: (workspaceId: string) => `campaigns:${workspaceId}`,
  metrics: (workspaceId: string, period: string) =>
    `metrics:${workspaceId}:${period}`,
  benchmarks: (industry: string, channel: string) =>
    `benchmarks:${industry}:${channel}`,
  forecast: (workspaceId: string, campaignId: string) =>
    `forecast:${workspaceId}:${campaignId}`,
};
