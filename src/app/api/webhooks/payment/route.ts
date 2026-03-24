// POST /api/webhooks/payment
// Recebe confirmações de pagamento do Pagar.me e ativa o plano no workspace.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { activateSubscription, createTrialSubscription } from '@/services/subscription'

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha1', secret)
    .update(body)
    .digest('hex')
  return `sha1=${expected}` === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verifica assinatura do Pagar.me (se secret configurado)
  const secret = process.env.PAGARME_WEBHOOK_SECRET
  if (secret) {
    const signature = req.headers.get('x-hub-signature') ?? ''
    if (!verifySignature(rawBody, signature, secret)) {
      console.warn('[webhook/payment] Assinatura inválida')
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
    }
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const eventType = event.type as string
  const data = event.data as Record<string, unknown> | undefined

  console.log(`[webhook/payment] Evento recebido: ${eventType}`)

  // Salva evento bruto para auditoria
  try {
    const eventId = (event.id as string) ?? `${eventType}-${Date.now()}`
    await db.paymentEvent.upsert({
      where: { eventId },
      create: { eventId, eventType, payload: event as object },
      update: { processed: false },
    })
  } catch (err) {
    console.error('[webhook/payment] Erro ao salvar evento:', err)
  }

  // Extrai o order_id do evento (Pagar.me v5 envia via charge ou order)
  const orderId =
    ((data?.order as Record<string, unknown>)?.id as string | undefined) ??
    (data?.id as string | undefined)

  if (!orderId) {
    return NextResponse.json({ received: true, note: 'Sem order_id no evento' })
  }

  // Eventos de pagamento confirmado
  if (eventType === 'charge.paid' || eventType === 'order.paid') {
    try {
      const payment = await db.payment.findFirst({
        where: { pagarmeOrderId: orderId, status: 'PENDING' },
      })

      if (!payment) {
        console.log(`[webhook/payment] Pagamento não encontrado ou já processado: ${orderId}`)
        return NextResponse.json({ received: true })
      }

      // Verifica se é novo cadastro (trial) ou renovação
      const existingSub = await db.subscription.findFirst({
        where: { workspaceId: payment.workspaceId },
        orderBy: { createdAt: 'desc' },
      })

      // Novo cadastro = sem assinatura prévia; qualquer sub existente indica renovação
      const isNewSignup = !existingSub

      if (isNewSignup) {
        await createTrialSubscription(payment.workspaceId, payment.id)
        console.log(`[webhook/payment] Trial ativado (7 dias) — workspace: ${payment.workspaceId}`)
      } else {
        await activateSubscription(payment.workspaceId, payment.id)
        console.log(`[webhook/payment] Assinatura renovada — workspace: ${payment.workspaceId}`)
      }

      // Atualiza evento como processado
      await db.paymentEvent.updateMany({
        where: { eventType, payload: { path: ['data', 'order', 'id'], equals: orderId } },
        data: { processed: true },
      })
    } catch (err) {
      console.error('[webhook/payment] Erro ao ativar plano:', err)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
  }

  // Eventos de falha
  if (eventType === 'charge.payment_failed') {
    try {
      await db.payment.updateMany({
        where: { pagarmeOrderId: orderId, status: 'PENDING' },
        data: { status: 'FAILED', failedAt: new Date() },
      })
      console.log(`[webhook/payment] Pagamento marcado como falhou: ${orderId}`)
    } catch (err) {
      console.error('[webhook/payment] Erro ao marcar falha:', err)
    }
  }

  return NextResponse.json({ received: true })
}
