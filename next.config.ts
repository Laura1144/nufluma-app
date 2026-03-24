import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Em dev: permite qualquer origem (localhost). Em prod: apenas nufluma.com
const corsOrigin = process.env.NODE_ENV === "development" ? "*" : "https://nufluma.com"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  // Declara Turbopack como bundler intencional (Next.js 16 padrão)
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.facebook.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        // CORS para /api/payment — permite chamadas do checkout em nufluma.com
        source: "/api/payment",
        headers: [
          { key: "Access-Control-Allow-Origin", value: corsOrigin },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        // CORS para /api/auth/register-and-pay — permite chamadas do checkout externo
        source: "/api/auth/register-and-pay",
        headers: [
          { key: "Access-Control-Allow-Origin", value: corsOrigin },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Token da organização/projeto Sentry (definir em .env como SENTRY_AUTH_TOKEN)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Faz upload dos source maps apenas em produção
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  // Suprime o output verboso do Sentry durante o build
  silent: true,

  // Desabilita o tunnel para requests do Sentry (simplifica infraestrutura)
  tunnelRoute: undefined,
});
