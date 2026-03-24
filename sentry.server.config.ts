import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Captura 100% dos traces em desenvolvimento; ajuste para produção (ex: 0.1)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Não loga no servidor em dev para não poluir o console
  debug: false,
});
