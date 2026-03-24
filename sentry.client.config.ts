import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Captura 100% dos traces em desenvolvimento; ajuste para produção (ex: 0.1)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replays: grava apenas sessões onde houve erro
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  integrations: [
    Sentry.replayIntegration({
      // Mascara texto e inputs para proteção de dados (LGPD)
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Suprime erros de cancelamentos de requisição (AbortError)
  ignoreErrors: [
    "AbortError",
    "TypeError: Failed to fetch",
    "TypeError: NetworkError",
  ],

  debug: false,
});
