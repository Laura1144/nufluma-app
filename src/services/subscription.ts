import { db } from "@/lib/db"
import { TRIAL_DAYS } from "@/lib/constants"

// Cria subscription de trial (7 dias) após pagamento confirmado
export async function createTrialSubscription(workspaceId: string, paymentId: string) {
  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: now },
  })

  const existing = await db.subscription.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  let sub
  if (existing) {
    sub = await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "TRIALING",
        plan: "pro",
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    })
  } else {
    sub = await db.subscription.create({
      data: {
        workspaceId,
        status: "TRIALING",
        plan: "pro",
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
    })
  }

  await Promise.all([
    db.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } }),
    db.workspace.update({ where: { id: workspaceId }, data: { plan: "pro" } }),
  ])

  return sub
}

// Ativa subscription mensal (renovação após trial expirado)
export async function activateSubscription(workspaceId: string, paymentId: string) {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: now },
  })

  const existing = await db.subscription.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  })

  let sub
  if (existing) {
    sub = await db.subscription.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        plan: "pro",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      },
    })
  } else {
    sub = await db.subscription.create({
      data: {
        workspaceId,
        status: "ACTIVE",
        plan: "pro",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    })
  }

  await Promise.all([
    db.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } }),
    db.workspace.update({ where: { id: workspaceId }, data: { plan: "pro" } }),
  ])

  return sub
}

// Cancela subscription do workspace
export async function cancelSubscription(workspaceId: string) {
  const now = new Date()

  const existing = await db.subscription.findFirst({
    where: { workspaceId, status: { in: ["TRIALING", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
  })

  if (!existing) return null

  const sub = await db.subscription.update({
    where: { id: existing.id },
    data: { status: "CANCELLED", cancelledAt: now },
  })

  await db.workspace.update({ where: { id: workspaceId }, data: { plan: "free" } })

  return sub
}

export async function getActiveSubscription(workspaceId: string) {
  return db.subscription.findFirst({
    where: { workspaceId, status: { in: ["TRIALING", "ACTIVE"] } },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { createdAt: "desc" },
  })
}
