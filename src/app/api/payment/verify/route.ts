// GET /api/payment/verify?order_id=xxx&payment_db_id=xxx&workspace_id=xxx
// Consulta Pagar.me e, se pago, ativa o plano.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { activateSubscription, createTrialSubscription } from '@/services/subscription'

const PAGARME_URL = 'https://api.pagar.me/core/v5'

function authHeader(apiKey: string) {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get('order_id')
  const paymentDbId = searchParams.get('payment_db_id')
  const workspaceId = searchParams.get('workspace_id')

  if (!orderId) {
    return NextResponse.json({ success: false, error: 'order_id obrigatório' }, { status: 400 })
  }

  const apiKey = process.env.PAGARME_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Serviço indisponível' }, { status: 503 })
  }

  let pagarmeRes: Response
  try {
    pagarmeRes = await fetch(`${PAGARME_URL}/orders/${orderId}`, {
      headers: { Authorization: authHeader(apiKey) },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao consultar pagamento' }, { status: 502 })
  }

  if (!pagarmeRes.ok) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 })
  }

  const order = await pagarmeRes.json() as { status: string; id: string }
  const paid = order.status === 'paid'

  // Se pago e temos os IDs necessários → ativa plano
  if (paid && paymentDbId && workspaceId) {
    try {
      const payment = await db.payment.findUnique({ where: { id: paymentDbId } })
      if (payment && payment.status === 'PENDING') {
        const existingSub = await db.subscription.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        })
        const isNewSignup = !existingSub ||
          (existingSub.status === 'TRIALING' && existingSub.trialEndsAt && existingSub.trialEndsAt <= new Date(1000))

        if (isNewSignup) {
          await createTrialSubscription(workspaceId, paymentDbId)
        } else {
          await activateSubscription(workspaceId, paymentDbId)
        }
      }
    } catch (err) {
      console.error('[verify] Erro ao ativar subscription:', err)
    }
  }

  return NextResponse.json({ success: true, status: order.status, paid })
}
