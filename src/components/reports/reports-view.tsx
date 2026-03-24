"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText, Download, Loader2, Plus, Clock,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { Report } from "@/types";

const statusIcons = {
  GENERATING: <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />,
  READY: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
};

const typeLabels: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  CUSTOM: "Personalizado",
};

export function ReportsView({ reports: initial }: { reports: Report[] }) {
  const [reports, setReports] = useState(initial);
  const [generating, startGenerate] = useTransition();
  const [form, setForm] = useState({
    type: "MONTHLY",
    profile: "MANAGER",
    periodStart: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    periodEnd: new Date().toISOString().split("T")[0],
  });

  const handleGenerate = () => {
    startGenerate(async () => {
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setReports((prev) => [data.report, ...prev]);
        toast.success("Relatório iniciado! Estará pronto em instantes.");
      } catch {
        toast.error("Erro ao gerar relatório");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Generate form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Gerar Novo Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Perfil</Label>
              <Select
                value={form.profile}
                onValueChange={(v) => setForm((f) => ({ ...f, profile: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">Gestor (executivo)</SelectItem>
                  <SelectItem value="TECHNICAL">Técnico (detalhado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Início do período</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Fim do período</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Gerar Relatório com IA
          </Button>
        </CardContent>
      </Card>

      {/* Reports list */}
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum relatório gerado ainda</p>
          </div>
        ) : (
          reports.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[r.type] ?? r.type}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {r.profile === "MANAGER" ? "Gestor" : "Técnico"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.periodStart).toLocaleDateString("pt-BR")} –{" "}
                        {new Date(r.periodEnd).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex items-center gap-1">
                        {statusIcons[r.status]}
                        <span className="text-xs text-muted-foreground">
                          {r.status === "GENERATING" ? "Gerando..." : r.status === "READY" ? "Pronto" : "Falhou"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                    {r.status === "READY" && r.pdfUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="gap-1.5 text-xs"
                      >
                        <a href={r.pdfUrl} download>
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
