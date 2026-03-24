"use client"

import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  CreditCard, QrCode, FileText, ChevronRight, ChevronLeft,
  Copy, CheckCircle2, Loader2, Zap, Shield
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSuccess?: () => void
}

type Step = "customer" | "address" | "payment"
type Method = "pix" | "boleto" | "credit_card"

interface FormData {
  name: string; email: string; phone: string; document: string
  street: string; street_number: string; neighborhood: string
  zipcode: string; city: string; state: string
  card_number: string; card_name: string; card_expiry: string; card_cvv: string
  installments: string
}

const AMOUNT_BRL = "R$ 169,90"
const FEATURES = [
  "Dashboard de analytics em tempo real",
  "Forecast com IA",
  "Alertas inteligentes automatizados",
  "Consultor IA integrado (GPT-4o)",
  "Relatórios automatizados",
  "Benchmarks do setor",
  "Integrações Google Ads + Meta Ads",
  "Suporte prioritário",
]

function mask(value: string, pattern: string) {
  const digits = value.replace(/\D/g, "")
  let result = ""
  let di = 0
  for (let i = 0; i < pattern.length && di < digits.length; i++) {
    result += pattern[i] === "9" ? digits[di++] : pattern[i]
  }
  return result
}

export function CheckoutDialog({ open, onOpenChange, workspaceId, onSuccess }: CheckoutDialogProps) {
  const [step, setStep] = useState<Step>("customer")
  const [method, setMethod] = useState<Method>("pix")
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)
  const [result, setResult] = useState<Record<string, string> | null>(null)
  const [polling, setPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState<FormData>({
    name: "", email: "", phone: "", document: "",
    street: "", street_number: "", neighborhood: "", zipcode: "", city: "", state: "",
    card_number: "", card_name: "", card_expiry: "", card_cvv: "",
    installments: "1",
  })

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleClose = () => {
    if (polling) return
    stopPolling()
    onOpenChange(false)
    setTimeout(() => {
      setStep("customer")
      setResult(null)
      setForm({
        name: "", email: "", phone: "", document: "",
        street: "", street_number: "", neighborhood: "", zipcode: "", city: "", state: "",
        card_number: "", card_name: "", card_expiry: "", card_cvv: "",
        installments: "1",
      })
    }, 300)
  }

  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "")
    if (digits.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json() as Record<string, string>
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          street: data.logradouro ?? "",
          neighborhood: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        }))
      }
    } catch { /* ignore */ }
    setLoadingCep(false)
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }

  const startPolling = (orderId: string, paymentDbId: string) => {
    setPolling(true)
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 60) { // 5 minutos (5s * 60)
        stopPolling()
        return
      }
      try {
        const params = new URLSearchParams({
          order_id: orderId,
          payment_db_id: paymentDbId,
          workspace_id: workspaceId,
        })
        const res = await fetch(`/api/payment/verify?${params}`)
        const data = await res.json() as { paid: boolean }
        if (data.paid) {
          stopPolling()
          toast.success("Pagamento confirmado! Plano Pro ativado.")
          onSuccess?.()
          handleClose()
        }
      } catch { /* continua tentando */ }
    }, 5000)
  }

  const submit = async () => {
    setLoading(true)
    try {
      const expiry = form.card_expiry.replace("/", "")
      const body = {
        workspace_id: workspaceId,
        payment_method: method,
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          document: form.document,
        },
        billing: {
          address: {
            street: form.street,
            street_number: form.street_number,
            neighborhood: form.neighborhood,
            zipcode: form.zipcode,
            city: form.city,
            state: form.state,
          },
        },
        ...(method === "credit_card" && {
          card: {
            number: form.card_number,
            holder_name: form.card_name,
            expiration_date: expiry,
            cvv: form.card_cvv,
          },
          installments: parseInt(form.installments, 10),
        }),
      }

      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json() as Record<string, string>

      if (!res.ok || !data.success) {
        toast.error(data.error || "Erro ao processar pagamento")
        return
      }

      setResult(data)

      if (method === "credit_card") {
        if (data.status === "paid") {
          toast.success("Pagamento aprovado! Plano Pro ativado.")
          onSuccess?.()
          handleClose()
        } else {
          toast.error("Pagamento não aprovado. Verifique os dados do cartão.")
        }
      } else {
        // PIX ou Boleto: inicia polling
        if (data.payment_db_id && data.order_id) {
          startPolling(data.order_id, data.payment_db_id)
        }
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copiado!")
  }

  const canProceedCustomer =
    form.name.trim() && form.email.includes("@") && form.phone.replace(/\D/g, "").length >= 10 &&
    [11, 14].includes(form.document.replace(/\D/g, "").length)
  const canProceedAddress =
    form.street && form.street_number && form.neighborhood && form.zipcode && form.city && form.state

  // ── Tela de resultado PIX ──────────────────────────────────────────────────
  if (result && method === "pix") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" /> PIX — Aguardando pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            {result.qr_code_url && (
              <div className="flex justify-center">
                <Image
                  src={result.qr_code_url}
                  alt="QR Code PIX"
                  width={180}
                  height={180}
                  className="rounded-lg border border-border"
                />
              </div>
            )}
            {result.qr_code && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Código PIX copia e cola:</p>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all text-left">
                    {result.qr_code}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(result.qr_code!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando confirmação do pagamento...
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              O QR Code expira em 1 hora. Após o pagamento, o plano é ativado automaticamente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Tela de resultado Boleto ───────────────────────────────────────────────
  if (result && method === "boleto") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Boleto gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {result.line && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Linha digitável:</p>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                    {result.line}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => copyToClipboard(result.line!)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {result.boleto_url && (
              <Button asChild className="w-full">
                <a href={result.boleto_url} target="_blank" rel="noopener noreferrer">
                  Abrir boleto em PDF
                </a>
              </Button>
            )}
            {result.due_at && (
              <p className="text-xs text-muted-foreground text-center">
                Vencimento: {new Date(result.due_at).toLocaleDateString("pt-BR")}
              </p>
            )}
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando confirmação...
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Após o pagamento compensar (até 2 dias úteis), o plano será ativado automaticamente.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ── Formulário principal ───────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="grid md:grid-cols-[1fr_280px]">

          {/* Formulário */}
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-5 w-5 text-primary" /> Assinar Nufluma Pro
              </DialogTitle>
            </DialogHeader>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 text-xs">
              {(["customer", "address", "payment"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                    ${step === s ? "bg-primary text-white" : i < ["customer","address","payment"].indexOf(step) ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {i < ["customer","address","payment"].indexOf(step) ? "✓" : i + 1}
                  </div>
                  <span className={step === s ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {s === "customer" ? "Dados" : s === "address" ? "Endereço" : "Pagamento"}
                  </span>
                  {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>

            {/* Step 1: Dados pessoais */}
            {step === "customer" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome completo</Label>
                    <Input placeholder="João Silva" value={form.name}
                      onChange={e => set("name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" placeholder="joao@empresa.com" value={form.email}
                      onChange={e => set("email", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 99999-9999" value={form.phone}
                      onChange={e => set("phone", mask(e.target.value, "(99) 99999-9999"))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF / CNPJ</Label>
                    <Input placeholder="000.000.000-00"
                      value={form.document}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, "")
                        set("document", d.length <= 11
                          ? mask(e.target.value, "999.999.999-99")
                          : mask(e.target.value, "99.999.999/9999-99"))
                      }} />
                  </div>
                </div>
                <Button className="w-full" disabled={!canProceedCustomer}
                  onClick={() => setStep("address")}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Step 2: Endereço */}
            {step === "address" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>CEP</Label>
                    <div className="flex gap-2">
                      <Input placeholder="00000-000" value={form.zipcode}
                        onChange={e => {
                          const v = mask(e.target.value, "99999-999")
                          set("zipcode", v)
                          if (v.replace(/\D/g, "").length === 8) lookupCep(v)
                        }} />
                      {loadingCep && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rua</Label>
                    <Input placeholder="Av. Paulista" value={form.street}
                      onChange={e => set("street", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Número</Label>
                    <Input placeholder="1234" value={form.street_number}
                      onChange={e => set("street_number", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bairro</Label>
                    <Input placeholder="Bela Vista" value={form.neighborhood}
                      onChange={e => set("neighborhood", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input placeholder="São Paulo" value={form.city}
                      onChange={e => set("city", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado (UF)</Label>
                    <Input placeholder="SP" maxLength={2} value={form.state}
                      onChange={e => set("state", e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("customer")}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" disabled={!canProceedAddress}
                    onClick={() => setStep("payment")}>
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Pagamento */}
            {step === "payment" && (
              <div className="space-y-4">
                {/* Seleção de método */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "pix", label: "PIX", icon: QrCode },
                    { id: "boleto", label: "Boleto", icon: FileText },
                    { id: "credit_card", label: "Cartão", icon: CreditCard },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id}
                      onClick={() => setMethod(id)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors
                        ${method === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                      <Icon className="h-5 w-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* PIX */}
                {method === "pix" && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-center space-y-1">
                    <QrCode className="h-8 w-8 mx-auto text-primary" />
                    <p className="font-medium">Pague via PIX</p>
                    <p className="text-xs text-muted-foreground">
                      QR Code gerado após confirmação. Expira em 1 hora.
                    </p>
                  </div>
                )}

                {/* Boleto */}
                {method === "boleto" && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-center space-y-1">
                    <FileText className="h-8 w-8 mx-auto text-primary" />
                    <p className="font-medium">Pague via Boleto Bancário</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento em 3 dias úteis. Compensação em até 2 dias após pagamento.
                    </p>
                  </div>
                )}

                {/* Cartão */}
                {method === "credit_card" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Número do cartão</Label>
                      <Input placeholder="0000 0000 0000 0000" value={form.card_number}
                        onChange={e => set("card_number", mask(e.target.value, "9999 9999 9999 9999"))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome no cartão</Label>
                      <Input placeholder="JOAO SILVA" value={form.card_name}
                        onChange={e => set("card_name", e.target.value.toUpperCase())} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label>Validade</Label>
                        <Input placeholder="MM/AA" value={form.card_expiry}
                          onChange={e => set("card_expiry", mask(e.target.value, "99/99"))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CVV</Label>
                        <Input placeholder="123" maxLength={4} value={form.card_cvv}
                          onChange={e => set("card_cvv", e.target.value.replace(/\D/g, ""))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Parcelas</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.installments}
                        onChange={e => set("installments", e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>
                            {n}x de R$ {(169.90 / n).toFixed(2).replace(".", ",")} {n === 1 ? "(à vista)" : "sem juros"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("address")}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" onClick={submit} disabled={loading}>
                    {loading
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                      : <><CheckCircle2 className="h-4 w-4 mr-2" /> Pagar {AMOUNT_BRL}</>}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar do produto */}
          <div className="hidden md:flex flex-col bg-muted/40 border-l border-border p-6 space-y-4">
            <div>
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 mb-2">
                Plano Pro
              </Badge>
              <p className="text-2xl font-bold">{AMOUNT_BRL}</p>
              <p className="text-xs text-muted-foreground">por mês</p>
            </div>

            <ul className="space-y-2 flex-1">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4">
              <Shield className="h-3.5 w-3.5" />
              Garantia de 7 dias ou seu dinheiro de volta
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
