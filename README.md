# Nufluma — Marketing Analytics com IA

Plataforma SaaS de marketing analytics com health score, forecast preditivo, alertas automáticos, benchmarks, sugestões criativas com IA e consultor de dados.

## Stack

- **Framework**: Next.js 15 (App Router) + React 18 + TypeScript
- **UI**: TailwindCSS + shadcn/ui + Framer Motion
- **Gráficos**: Recharts
- **Banco**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth)
- **Cache/Filas**: Redis (ioredis)
- **IA**: OpenAI GPT-4o
- **Automações**: n8n (webhooks + jobs)
- **Observabilidade**: Sentry
- **Infra**: Docker Compose

## Início Rápido

### 1. Pré-requisitos

- Node.js 20+
- Docker e Docker Compose

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

Variáveis obrigatórias para rodar localmente:
- `DATABASE_URL` — já configurada para o Docker
- `AUTH_SECRET` — gere com `openssl rand -base64 32`
- `OPENAI_API_KEY` — necessária para features de IA
- `REDIS_URL` — já configurada para o Docker

### 3. Subir serviços (PostgreSQL + Redis + n8n)

```bash
docker compose up postgres redis n8n -d
```

### 4. Instalar dependências

```bash
npm install
```

### 5. Configurar banco de dados

```bash
npm run db:push      # Cria as tabelas
npm run db:seed      # Cria dados de demonstração
```

### 6. Rodar a aplicação

```bash
npm run dev
```

Acesse: [http://localhost:8000](http://localhost:8000)

**Credenciais de demo:**
- Email: `admin@nufluma.com`
- Senha: `Admin@1234`

### 7. Deploy completo com Docker

```bash
docker compose up -d
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Nufluma Platform                       │
│                                                           │
│  ┌──────────┐    ┌──────────────────────────────────┐   │
│  │  Next.js │    │           Services Layer          │   │
│  │ App Router│◄──►│  HealthScore │ Forecast │ AI     │   │
│  │  (UI+API)│    │  Alerts │ Benchmarks │ Reports    │   │
│  └────┬─────┘    └──────────────────┬───────────────┘   │
│       │                              │                    │
│  ┌────▼─────────────────────────────▼───────────────┐   │
│  │                  Prisma ORM                        │   │
│  └────┬─────────────────────────────────────────────┘   │
│       │                                                   │
│  ┌────▼──────┐  ┌──────────┐  ┌──────────────────┐     │
│  │ PostgreSQL│  │  Redis   │  │      n8n          │     │
│  │ (primary) │  │ (cache)  │  │ (automações)      │     │
│  └───────────┘  └──────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Módulos

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/dashboard` | KPIs, gráficos, health scores, missões |
| Campanhas | `/campaigns` | Lista e detalhe de campanhas |
| Alertas | `/alerts` | Central de alertas automáticos |
| Forecast | `/forecast` | Previsões preditivas com IC 95% |
| Benchmarks | `/benchmarks` | Comparação com média do setor |
| Sugestões | `/suggestions` | Copy e criativos gerados por IA |
| Relatórios | `/reports` | Narrativos em PDF |
| Consultor IA | `/consultor` | Chat com seus dados |
| Configurações | `/settings` | Workspace, membros, integrações, API keys |

## Segurança

- RBAC: `ADMIN > MANAGER > ANALYST > VIEWER`
- Multi-tenant com isolamento por `workspaceId`
- Rate limiting por IP via Redis
- HMAC-SHA256 para webhooks (n8n)
- API keys hasheadas (SHA-256)
- Tokens OAuth criptografados
- Audit log de todas as ações
- Proteção: CSRF, XSS, CORS, validação Zod

## Integrações n8n

### Webhook de ingestão
```
POST /api/webhooks/ingest
Header: X-Nufluma-Signature: <hmac-sha256>
Body: {
  workspaceId: string,
  source: "n8n" | "google_ads" | "meta_ads",
  data: Metric[]
}
```

### Jobs disponíveis
- `POST /api/forecast` — Geração de forecast
- `POST /api/reports` — Geração de relatórios PDF
- `POST /api/insights/causal` — Análise causal com IA

## Variáveis de ambiente completas

Ver `.env.example` para lista completa.
