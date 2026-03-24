import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { rateLimit } from "@/lib/rate-limit"
import { createTrialSubscription } from "@/services/subscription"
import { PLAN_PRICE_CENTS, PLAN_PRICE_BRL, TRIAL_DAYS } from "@/lib/constants"
import { isValidCpf, isValidCnpj } from "@/lib/utils"

const PAGARME_URL = "https://api.pagar.me/core/v5"

function authHeader(apiKey: string) {
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64")
}

function parsePhone(phone: string) {
  const d = phone.replace(/\D/g, "")
  return {
    mobile_phone: {
      country_code: "55",
      area_code: d.slice(0, 2),
      number: d.slice(2),
    },
  }
}

function buildAddress(addr: {
  street: string
  street_number: string
  neighborhood: string
  zipcode: string
  city: string
  state: string
}) {
  return {
    line_1: `${addr.street_number}, ${addr.street}, ${addr.neighborhood}`,
    zip_code: addr.zipcode.replace(/\D/g, ""),
    city: addr.city,
    state: addr.state,
    country: "BR",
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function POST(req: NextRequest) {
  const { ok } = await rateLimit(req, "auth")
  if (!ok) return NextResponse.json({ success: false, error: "Muitas tentativas. Aguarde e tente novamente." }, { status: 429 })

  const apiKey = process.env.PAGARME_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "Serviço de pagamento indisponível" }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 })
  }

  const {
    name,
    email,
    password,
    workspace_name,
    payment_method,
    customer,
    billing,
    card,
    installments = 1,
  } = body as {
    name: string
    email: string
    password: string
    workspace_name?: string
    payment_method: string
    customer: { name: string; email: string; phone: string; document: string }
    billing: {
      address: {
        street: string
        street_number: string
        neighborhood: string
        zipcode: string
        city: string
        state: string
      }
    }
    card?: { number: string; holder_name: string; expiration_date: string; cvv: string }
    installments?: number
  }

  // ── Validações básicas ─────────────────────────────────────────────────────
  if (!name || name.trim().length < 2) {
    return NextResponse.json({ success: false, error: "Nome deve ter pelo menos 2 caracteres" }, { status: 422 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "E-mail inválido" }, { status: 422 })
  }
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({
      success: false,
      error: "Senha deve ter ao menos 8 caracteres, uma letra maiúscula e um número",
    }, { status: 422 })
  }
  if (!payment_method || !customer?.name || !customer?.email || !billing?.address) {
    return NextResponse.json({ success: false, error: "Dados de pagamento incompletos" }, { status: 422 })
  }

  // ── Verifica se e-mail já existe ───────────────────────────────────────────
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ success: false, error: "E-mail já cadastrado. Faça login para continuar." }, { status: 409 })
  }

  const docDigits = customer.document?.replace(/\D/g, "") ?? ""
  const isCompany = docDigits.length === 14

  if (docDigits.length !== 11 && docDigits.length !== 14) {
    return NextResponse.json({ success: false, error: "Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos)" }, { status: 422 })
  }
  if (docDigits.length === 11 && !isValidCpf(docDigits)) {
    return NextResponse.json({ success: false, error: "CPF inválido" }, { status: 422 })
  }
  if (docDigits.length === 14 && !isValidCnpj(docDigits)) {
    return NextResponse.json({ success: false, error: "CNPJ inválido" }, { status: 422 })
  }

  const pagarmeCustomer = {
    name: customer.name,
    email: customer.email,
    type: isCompany ? "company" : "individual",
    document: docDigits,
    document_type: isCompany ? "CNPJ" : "CPF",
    phones: parsePhone(customer.phone),
  }

  const address = buildAddress(billing.address)

  let payments: unknown[]

  if (payment_method === "pix") {
    payments = [{ payment_method: "pix", pix: { expires_in: 3600 } }]
  } else if (payment_method === "boleto") {
    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + 3)
    payments = [{
      payment_method: "boleto",
      boleto: {
        instructions: `Nufluma Pro — Plano Mensal (7 dias grátis + ${PLAN_PRICE_BRL}/mês)`,
        due_at: dueAt.toISOString(),
      },
    }]
  } else if (payment_method === "credit_card") {
    if (!card?.number || !card.holder_name || !card.expiration_date || !card.cvv) {
      return NextResponse.json({ success: false, error: "Dados do cartão incompletos" }, { status: 422 })
    }
    const expMonth = parseInt(card.expiration_date.slice(0, 2), 10)
    const expYear = parseInt("20" + card.expiration_date.slice(2, 4), 10)
    payments = [{
      payment_method: "credit_card",
      credit_card: {
        installments: Number(installments),
        billing_address: address,
        card: {
          number: card.number.replace(/\s/g, ""),
          holder_name: card.holder_name,
          exp_month: expMonth,
          exp_year: expYear,
          cvv: card.cvv,
        },
      },
    }]
  } else {
    return NextResponse.json({ success: false, error: "Método de pagamento inválido" }, { status: 422 })
  }

  const orderPayload = {
    items: [{
      amount: PLAN_PRICE_CENTS,
      description: `Nufluma Pro — 7 dias grátis + ${PLAN_PRICE_BRL}/mês`,
      quantity: 1,
      code: "NUFLUMA_PRO",
    }],
    customer: pagarmeCustomer,
    payments,
  }

  // ── Cria ordem no Pagar.me ─────────────────────────────────────────────────
  let pagarmeResponse: Response
  try {
    pagarmeResponse = await fetch(`${PAGARME_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    })
  } catch (err) {
    console.error("[register-and-pay] Erro Pagar.me:", err)
    return NextResponse.json({ success: false, error: "Falha ao processar pagamento. Tente novamente." }, { status: 502 })
  }

  const rawText = await pagarmeResponse.text()
  let pagarmeResult: Record<string, unknown>
  try {
    pagarmeResult = JSON.parse(rawText)
  } catch {
    pagarmeResult = {}
  }

  if (!pagarmeResponse.ok) {
    const message =
      (pagarmeResult.message as string) ||
      ((pagarmeResult.errors as { message?: string }[])?.[0]?.message) ||
      `Erro ${pagarmeResponse.status} ao processar pagamento.`
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }

  const charges = pagarmeResult.charges as { last_transaction: Record<string, unknown> }[] | undefined
  const tx = charges?.[0]?.last_transaction ?? {}
  const pagarmeOrderId = pagarmeResult.id as string
  const orderStatus = pagarmeResult.status as string

  // ── Cria conta do usuário + workspace + subscription ───────────────────────
  const passwordHash = await bcrypt.hash(password, 12)
  const workspaceDisplayName = workspace_name?.trim() || name.trim()
  let baseSlug = slugify(workspaceDisplayName)
  if (!baseSlug) baseSlug = "workspace"

  // Garante slug único
  let slug = baseSlug
  let counter = 0
  while (await db.workspace.findUnique({ where: { slug } })) {
    counter++
    slug = `${baseSlug}-${counter}`
  }

  let user, workspace, paymentRecord

  try {
    user = await db.user.create({
      data: { name: name.trim(), email, passwordHash },
      select: { id: true, email: true, name: true },
    })

    workspace = await db.workspace.create({
      data: {
        name: workspaceDisplayName,
        slug,
        plan: "pro",
        members: {
          create: { userId: user.id, role: "ADMIN", joinedAt: new Date() },
        },
      },
    })

    const methodEnum = payment_method === "pix" ? "PIX" : payment_method === "boleto" ? "BOLETO" : "CREDIT_CARD"

    const pixExpiresAt = payment_method === "pix" && tx.expires_at
      ? new Date(tx.expires_at as string)
      : undefined
    const boletoDueAt = payment_method === "boleto" && tx.due_at
      ? new Date(tx.due_at as string)
      : undefined

    paymentRecord = await db.payment.create({
      data: {
        workspaceId: workspace.id,
        pagarmeOrderId,
        amount: PLAN_PRICE_CENTS,
        method: methodEnum,
        status: "PENDING",
        pixQrCode: payment_method === "pix" ? (tx.qr_code as string | undefined) : undefined,
        pixQrCodeUrl: payment_method === "pix" ? (tx.qr_code_url as string | undefined) : undefined,
        pixExpiresAt,
        boletoLine: payment_method === "boleto" ? (tx.line as string | undefined) : undefined,
        boletoUrl: payment_method === "boleto" ? (tx.pdf as string | undefined) : undefined,
        boletoDueAt,
      },
    })

    // Cartão aprovado → ativa trial de 7 dias imediatamente
    if (payment_method === "credit_card" && orderStatus === "paid") {
      await createTrialSubscription(workspace.id, paymentRecord.id)
    } else {
      // PIX/Boleto → cria subscription pendente (trial começa após confirmação do pagamento)
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
      await db.subscription.create({
        data: {
          workspaceId: workspace.id,
          status: "TRIALING",
          plan: "pro",
          trialEndsAt: new Date(0), // trial só começa após pagamento confirmado
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(0),
          payments: { connect: { id: paymentRecord.id } },
        },
      })
    }
  } catch (err) {
    console.error("[register-and-pay] Erro ao criar conta:", err)
    // Tenta reverter usuário se criado
    if (user?.id) {
      await db.user.delete({ where: { id: user.id } }).catch(() => null)
    }
    return NextResponse.json({ success: false, error: "Erro ao criar sua conta. Contate o suporte." }, { status: 500 })
  }

  // ── Notifica n8n ───────────────────────────────────────────────────────────
  if (process.env.N8N_PAYMENT_WEBHOOK_URL) {
    const n8nPayload = {
      event: "new_signup",
      payment_method,
      order_id: pagarmeOrderId,
      payment_db_id: paymentRecord.id,
      workspace_id: workspace.id,
      customer: { name: customer.name, email: customer.email },
      amount_brl: PLAN_PRICE_BRL,
      trial_days: TRIAL_DAYS,
      ...(payment_method === "pix" && {
        pix_qr_code: tx.qr_code,
        pix_qr_code_url: tx.qr_code_url,
        pix_expires_at: tx.expires_at,
      }),
      ...(payment_method === "boleto" && {
        boleto_line: tx.line,
        boleto_url: tx.pdf,
        boleto_due_at: tx.due_at,
      }),
    }

    const n8nUrl = process.env.N8N_PAYMENT_WEBHOOK_URL
    // Fire-and-forget com retry (3 tentativas, backoff de 1s/2s)
    ;(async () => {
      const MAX_ATTEMPTS = 3
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(n8nUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(n8nPayload),
            signal: AbortSignal.timeout(5000),
          })
          if (res.ok) return
          console.warn(`[register-and-pay] n8n retornou ${res.status} (tentativa ${attempt}/${MAX_ATTEMPTS})`)
        } catch (err) {
          console.error(`[register-and-pay] Erro ao notificar n8n (tentativa ${attempt}/${MAX_ATTEMPTS}):`, err)
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        }
      }
      console.error("[register-and-pay] Todas as tentativas de notificação ao n8n falharam — order_id:", pagarmeOrderId)
    })()
  }

  // ── Resposta ───────────────────────────────────────────────────────────────
  const trialActive = payment_method === "credit_card" && orderStatus === "paid"
  const trialEndsAt = trialActive
    ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null

  const base = {
    success: true,
    payment_method,
    order_id: pagarmeOrderId,
    status: orderStatus,
    payment_db_id: paymentRecord.id,
    workspace_id: workspace.id,
    user_email: email,
    trial_active: trialActive,
    trial_ends_at: trialEndsAt,
  }

  if (payment_method === "pix") {
    return NextResponse.json({
      ...base,
      qr_code: tx.qr_code,
      qr_code_url: tx.qr_code_url,
      expires_at: tx.expires_at,
    }, { status: 201 })
  }

  if (payment_method === "boleto") {
    return NextResponse.json({
      ...base,
      line: tx.line,
      boleto_url: tx.pdf,
      due_at: tx.due_at,
    }, { status: 201 })
  }

  return NextResponse.json(base, { status: 201 })
}
