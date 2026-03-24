"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2, Plug, ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const workspaceSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(100),
  industry: z.string().optional(),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

const INTEGRATIONS = [
  { id: "GOOGLE_ADS", name: "Google Ads", icon: "G", description: "Importe campanhas e métricas do Google Ads" },
  { id: "META_ADS", name: "Meta Ads", icon: "M", description: "Facebook e Instagram Ads" },
  { id: "CSV_IMPORT", name: "Import CSV", icon: "📄", description: "Importe dados via arquivo CSV" },
];

const INDUSTRIES = [
  "E-commerce", "SaaS", "Educação", "Saúde", "Imóveis",
  "Agência", "Varejo", "Serviços", "Outro",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
  });

  const [selectedIndustry, setSelectedIndustry] = useState<string>("");

  const createWorkspace = async (data: WorkspaceForm) => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setWorkspaceId(json.workspaceId);
      setStep(2);
    } catch {
      toast.error("Erro ao criar workspace. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      // Create sample data for demo
      if (workspaceId) {
        await fetch("/api/onboarding/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, integrations: selectedIntegrations }),
        });
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-nufluma-dark overflow-hidden flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo-nufluma.png"
            alt="Nufluma"
            width={180}
            height={54}
            priority
            className="h-auto w-40"
          />
        </div>

        {/* Steps indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                step > s ? "bg-green-500 text-white" : step === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              )}>
                {step > s ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 2 && <div className={cn("h-0.5 w-8", step > s ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Step 1: Create workspace ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="glass-card neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Criar seu Workspace
                  </CardTitle>
                  <CardDescription>
                    Seu espaço privado de analytics — todos os dados ficam isolados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(createWorkspace)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Nome da empresa ou projeto *</Label>
                      <Input
                        placeholder="Ex: Acme Marketing"
                        autoFocus
                        {...register("name")}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Setor (opcional)</Label>
                      <div className="flex flex-wrap gap-2">
                        {INDUSTRIES.map((ind) => (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => {
                              const next = selectedIndustry === ind ? "" : ind;
                              setSelectedIndustry(next);
                              setValue("industry", next || undefined);
                            }}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs transition-colors",
                              selectedIndustry === ind
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary hover:text-primary"
                            )}
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" className="w-full gap-2" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Criar Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 2: Connect integrations ─────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="glass-card neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plug className="h-5 w-5 text-primary" />
                    Conectar Integrações
                  </CardTitle>
                  <CardDescription>
                    Escolha suas fontes de dados (você pode adicionar mais depois)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {INTEGRATIONS.map((intg) => {
                    const selected = selectedIntegrations.includes(intg.id);
                    return (
                      <button
                        key={intg.id}
                        type="button"
                        onClick={() => {
                          setSelectedIntegrations((prev) =>
                            selected ? prev.filter((i) => i !== intg.id) : [...prev, intg.id]
                          );
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/10 neon-border"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold">
                          {intg.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{intg.name}</p>
                          <p className="text-xs text-muted-foreground">{intg.description}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}

                  <div className="pt-2 space-y-2">
                    <Button className="w-full gap-2" onClick={finishOnboarding} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Ir para o Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground"
                      onClick={finishOnboarding}
                    >
                      Pular por agora
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
