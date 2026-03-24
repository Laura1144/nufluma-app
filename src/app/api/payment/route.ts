import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { activateSubscription } from '@/services/subscription'
import { PLAN_PRICE_CENTS, PLAN_PRICE_BRL } from '@/lib/constants'
import { isValidCpf, isValidCnpj } from '@/lib/utils'

const PAGARME_URL = 'https://api.pagar.me/core/v5'

function authHeader(apiKey: string) {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

function parsePhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  return {
    mobile_phone: {
      country_code: '55',
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
    zip_code: addr.zipcode.replace(/\D/g, ''),
    city: addr.city,
    state: addr.state,
    country: 'BR',
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.PAGARME_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Serviço de pagamento indisponível' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const {
    payment_method,
    customer,
    billing,
    card,
    installments = 1,
    workspace_id,
  } = body as {
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
    workspace_id?: string
  }

  if (!payment_method || !customer?.name || !customer?.email || !billing?.address) {
    return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 422 })
  }

  const docDigits = customer.document?.replace(/\D/g, '') ?? ''
  const isCompany = docDigits.length === 14

  if (docDigits.length !== 11 && docDigits.length !== 14) {
    return NextResponse.json({ success: false, error: 'Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos)' }, { status: 422 })
  }
  if (docDigits.length === 11 && !isValidCpf(docDigits)) {
    return NextResponse.json({ success: false, error: 'CPF inválido' }, { status: 422 })
  }
  if (docDigits.length === 14 && !isValidCnpj(docDigits)) {
    return NextResponse.json({ success: false, error: 'CNPJ inválido' }, { status: 422 })
  }

  const pagarmeCustomer = {
    name: customer.name,
    email: customer.email,
    type: isCompany ? 'company' : 'individual',
    document: docDigits,
    document_type: isCompany ? 'CNPJ' : 'CPF',
    phones: parsePhone(customer.phone),
  }

  const address = buildAddress(billing.address)

  let payments: unknown[]

  if (payment_method === 'pix') {
    payments = [{ payment_method: 'pix', pix: { expires_in: 3600 } }]
  } else if (payment_method === 'boleto') {
    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + 3)
    payments = [{
      payment_method: 'boleto',
      boleto: {
        instructions: 'Nufluma Pro — Plano Mensal',
        due_at: dueAt.toISOString(),
      },
    }]
  } else if (payment_method === 'credit_card') {
    if (!card?.number || !card.holder_name || !card.expiration_date || !card.cvv) {
      return NextResponse.json({ success: false, error: 'Dados do cartão incompletos' }, { status: 422 })
    }
    const expMonth = parseInt(card.expiration_date.slice(0, 2), 10)
    const expYear = parseInt('20' + card.expiration_date.slice(2, 4), 10)
    payments = [{
      payment_method: 'credit_card',
      credit_card: {
        installments: Number(installments),
        billing_address: address,
        card: {
          number: card.number.replace(/\s/g, ''),
          holder_name: card.holder_name,
          exp_month: expMonth,
          exp_year: expYear,
          cvv: card.cvv,
        },
      },
    }]
  } else {
    return NextResponse.json({ success: false, error: 'Método de pagamento inválido' }, { status: 422 })
  }

  const orderPayload = {
    items: [{
      amount: PLAN_PRICE_CENTS,
      description: 'Nufluma Pro — Plano Mensal',
      quantity: 1,
      code: 'NUFLUMA_PRO',
    }],
    customer: pagarmeCustomer,
    payments,
  }

  let response: Response
  try {
    response = await fetch(`${PAGARME_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })
  } catch (err) {
    console.error('[payment] Erro ao contatar Pagar.me:', err)
    return NextResponse.json(
      { success: false, error: 'Falha ao processar pagamento. Tente novamente.' },
      { status: 502 },
    )
  }

  const rawText = await response.text()
  console.log(`[payment] Pagar.me status: ${response.status}`)

  let result: Record<string, unknown>
  try {
    result = JSON.parse(rawText)
  } catch {
    result = {}
  }

  if (!response.ok) {
    const message =
      (result.message as string) ||
      ((result.errors as { message?: string }[])?.[0]?.message) ||
      `Erro ${response.status} ao processar pagamento.`
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }

  const charges = result.charges as { last_transaction: Record<string, unknown> }[] | undefined
  const tx = charges?.[0]?.last_transaction ?? {}
  const pagarmeOrderId = result.id as string
  const orderStatus = result.status as string

  // ── Persiste pagamento no banco (se workspace_id informado) ─────────────────
  let paymentRecord: { id: string } | null = null
  if (workspace_id) {
    const methodEnum = payment_method === 'pix'
      ? 'PIX'
      : payment_method === 'boleto'
      ? 'BOLETO'
      : 'CREDIT_CARD'

    const pixExpiresAt = payment_method === 'pix' && tx.expires_at
      ? new Date(tx.expires_at as string)
      : undefined
    const boletoDueAt = payment_method === 'boleto' && tx.due_at
      ? new Date(tx.due_at as string)
      : undefined

    try {
      paymentRecord = await db.payment.create({
        data: {
          workspaceId: workspace_id,
          pagarmeOrderId,
          amount: PLAN_PRICE_CENTS,
          method: methodEnum,
          status: 'PENDING',
          pixQrCode: payment_method === 'pix' ? (tx.qr_code as string | undefined) : undefined,
          pixQrCodeUrl: payment_method === 'pix' ? (tx.qr_code_url as string | undefined) : undefined,
          pixExpiresAt,
          boletoLine: payment_method === 'boleto' ? (tx.line as string | undefined) : undefined,
          boletoUrl: payment_method === 'boleto' ? (tx.pdf as string | undefined) : undefined,
          boletoDueAt,
        },
      })

      // Cartão aprovado → ativa plano imediatamente
      if (payment_method === 'credit_card' && orderStatus === 'paid') {
        await activateSubscription(workspace_id, paymentRecord.id)
      }

    } catch (err) {
      console.error('[payment] Erro ao salvar no banco:', err)
    }
  }

  // PIX ou Boleto → notifica n8n para enviar e-mail ao cliente (sempre, independente de workspace_id)
  if ((payment_method === 'pix' || payment_method === 'boleto') && process.env.N8N_PAYMENT_WEBHOOK_URL) {
    const n8nPayload = {
      event: 'payment_created',
      payment_method,
      order_id: pagarmeOrderId,
      payment_db_id: paymentRecord?.id ?? null,
      workspace_id: workspace_id ?? null,
      customer: {
        name: customer.name,
        email: customer.email,
      },
      amount_brl: PLAN_PRICE_BRL,
      ...(payment_method === 'pix' && {
        pix_qr_code: tx.qr_code,
        pix_qr_code_url: tx.qr_code_url,
        pix_expires_at: tx.expires_at,
      }),
      ...(payment_method === 'boleto' && {
        boleto_line: tx.line,
        boleto_url: tx.pdf,
        boleto_due_at: tx.due_at,
      }),
    }

    const n8nUrl = process.env.N8N_PAYMENT_WEBHOOK_URL;
    // Fire-and-forget com retry (3 tentativas, backoff de 1s/2s) para garantir entrega ao n8n
    ;(async () => {
      const MAX_ATTEMPTS = 3
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload),
            signal: AbortSignal.timeout(5000),
          })
          if (res.ok) return
          console.warn(`[payment] n8n retornou ${res.status} (tentativa ${attempt}/${MAX_ATTEMPTS})`)
        } catch (err) {
          console.error(`[payment] Erro ao notificar n8n (tentativa ${attempt}/${MAX_ATTEMPTS}):`, err)
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        }
      }
      console.error('[payment] Todas as tentativas de notificação ao n8n falharam — order_id:', pagarmeOrderId)
    })()
  }

  // ── Resposta ─────────────────────────────────────────────────────────────────
  const baseResult = {
    success: true,
    payment_method,
    order_id: pagarmeOrderId,
    status: orderStatus,
    payment_db_id: paymentRecord?.id ?? null,
  }

  if (payment_method === 'pix') {
    return NextResponse.json({
      ...baseResult,
      qr_code: tx.qr_code,
      qr_code_url: tx.qr_code_url,
      expires_at: tx.expires_at,
    }, { status: 201 })
  }

  if (payment_method === 'boleto') {
    return NextResponse.json({
      ...baseResult,
      line: tx.line,
      boleto_url: tx.pdf,
      due_at: tx.due_at,
    }, { status: 201 })
  }

  return NextResponse.json(baseResult, { status: 201 })
}
