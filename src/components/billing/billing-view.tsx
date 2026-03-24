"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckoutDialog } from "./checkout-dialog"
import {
  CreditCard, Zap, CheckCircle2, Clock, XCircle, AlertCircle, Receipt,
  AlertTriangle, Calendar, Ban
} from "lucide-react"
import { toast } from "sonner"
import type { Subscription, Payment } from "@prisma/client"

interface BillingViewProps {
  workspaceId: string
  plan: string
  subscription: (Subscription & { payments: Payment[] }) | null
}

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de Crédito",
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  PAID: { label: "Pago", icon: CheckCircle2, className: "text-green-500" },
  PENDING: { label: "Aguardando", icon: Clock, className: "text-yellow-500" },
  FAILED: { label: "Falhou", icon: XCircle, className: "text-red-500" },
  REFUNDED: { label: "Estornado", icon: AlertCircle, className: "text-orange-500" },
  CANCELLED: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground" },
}

const SUB_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  TRIALING: { label: "Trial", variant: "secondary" },
  PAST_DUE: { label: "Pagamento pendente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "outline" },
  EXPIRED: { label: "Expirado", variant: "outline" },
}

function getDaysRemaining(dateStr: string | Date | null | undefined): number | null {
  if (!dateStr) return null
  const end = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

export function BillingView({ workspaceId, plan, subscription }: BillingViewProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const router = useRouter()

  const isPro = plan === "pro"
  const subStatus = subscription?.status ? SUB_STATUS_CONFIG[subscription.status] : null
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")
    : null

  const isTrialing = subscription?.status === "TRIALING"
  const isActive = subscription?.status === "ACTIVE"
  const isCancelled = subscription?.status === "CANCELLED"
  const isExpired = subscription?.status === "EXPIRED"
  const isPastDue = subscription?.status === "PAST_DUE"
  const isBlocked = isCancelled || isExpired || isPastDue || !subscription

  const trialDaysRemaining = isTrialing ? getDaysRemaining(subscription?.trialEndsAt) : null
  const trialEnded = isTrialing && (trialDaysRemaining !== null && trialDaysRemaining <= 0)
  const periodDaysRemaining = isActive ? getDaysRemaining(subscription?.currentPeriodEnd) : null

  const handleSuccess = () => {
    router.refresh()
  }

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura? Você perderá o acesso ao final do período atual.")) return
    setCancelling(true)
    try {
      const res = await fetch("/api/subscription", { method: "DELETE" })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        toast.success("Assinatura cancelada. Você manterá o acesso até o fim do período.")
        router.refresh()
      } else {
        toast.error(data.error || "Erro ao cancelar assinatura")
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        workspaceId={workspaceId}
        onSuccess={handleSuccess}
      />

      <div className="space-y-6">

        {/* Banner de acesso bloqueado */}
        {(isBlocked || trialEnded) && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="font-semibold text-destructive">
                    {isPastDue ? "Pagamento pendente — acesso suspenso" :
                     isCancelled ? "Assinatura cancelada" :
                     isExpired ? "Assinatura expirada" :
                     trialEnded ? "Período de trial encerrado" :
                     "Sem assinatura ativa"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Para voltar a usar o Nufluma Pro, renove sua assinatura mensal por R$ 169,90/mês.
                  </p>
                  <Button onClick={() => setCheckoutOpen(true)} className="gap-2 mt-2">
                    <Zap className="h-4 w-4" /> Reativar assinatura — R$ 169,90/mês
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Banner de trial ativo */}
        {isTrialing && !trialEnded && trialDaysRemaining !== null && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">
                    {trialDaysRemaining > 0
                      ? `Trial ativo — ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? "s" : ""} restante${trialDaysRemaining !== 1 ? "s" : ""}`
                      : "Último dia de trial"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ao final do trial, você precisará renovar por R$ 169,90/mês para manter o acesso.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plano atual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plano atual</CardTitle>
            <CardDescription>Detalhes da sua assinatura</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className={`h-5 w-5 ${isPro ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xl font-bold capitalize">{isPro ? "Pro" : "Free"}</span>
                  {subStatus && (
                    <Badge variant={subStatus.variant} className="text-xs">
                      {subStatus.label}
                    </Badge>
                  )}
                </div>
                {isPro && !isBlocked && !trialEnded ? (
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>R$ 169,90 / mês</p>
                    {isTrialing && subscription?.trialEndsAt && (
                      <p>Trial encerra em: {new Date(subscription.trialEndsAt).toLocaleDateString("pt-BR")}</p>
                    )}
                    {isActive && periodEnd && <p>Renova em: {periodEnd}</p>}
                    {isActive && periodDaysRemaining !== null && periodDaysRemaining <= 7 && (
                      <p className="text-yellow-600">
                        Atenção: {periodDaysRemaining} dia{periodDaysRemaining !== 1 ? "s" : ""} para renovação
                      </p>
                    )}
                  </div>
                ) : !isPro ? (
                  <p className="text-sm text-muted-foreground">
                    Sem acesso às funcionalidades Pro.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 items-end">
                {(!isPro || isBlocked || trialEnded) && (
                  <Button onClick={() => setCheckoutOpen(true)} className="gap-2">
                    <Zap className="h-4 w-4" />
                    {isBlocked || trialEnded ? "Reativar Plano Pro" : "Assinar Plano Pro"} — R$ 169,90/mês
                  </Button>
                )}

                {(isActive || isTrialing) && !trialEnded && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {cancelling ? "Cancelando..." : "Cancelar assinatura"}
                  </Button>
                )}
              </div>
            </div>

            {(!isPro || isBlocked || trialEnded) && (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {[
                  "Dashboard de analytics em tempo real",
                  "Forecast com IA",
                  "Alertas inteligentes",
                  "Consultor IA (GPT-4o)",
                  "Relatórios automatizados",
                  "Benchmarks do setor",
                  "Integrações Google Ads + Meta Ads",
                  "Suporte prioritário",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Histórico de pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!subscription?.payments?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum pagamento registrado
              </p>
            ) : (
              <div className="space-y-2">
                {subscription.payments.map(p => {
                  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.PENDING
                  const Icon = cfg.icon
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {METHOD_LABEL[p.method] ?? p.method}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        R$ {(p.amount / 100).toFixed(2).replace(".", ",")}
                      </p>
                      <div className={`flex items-center gap-1 text-xs ${cfg.className}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
