import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Metadata } from "next"
import { BillingView } from "@/components/billing/billing-view"

export const metadata: Metadata = { title: "Cobrança" }

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.workspaceId) redirect("/login")
  const workspaceId = session.user.workspaceId

  const [workspace, subscription] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true, name: true } }),
    db.subscription.findFirst({
      where: { workspaceId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 20 } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cobrança</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu plano e histórico de pagamentos
        </p>
      </div>
      <BillingView
        workspaceId={workspaceId}
        plan={workspace?.plan ?? "free"}
        subscription={subscription}
      />
    </div>
  )
}
