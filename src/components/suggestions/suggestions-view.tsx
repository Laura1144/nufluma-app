"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lightbulb, Loader2, ThumbsUp, ThumbsDown,
  Sparkles, FileText, MousePointer, Target
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Suggestion {
  id: string;
  type: string;
  status: string;
  title: string;
  content: string;
  rationale: string | null;
  confidence: number | null;
  campaign: { name: string; channel: string } | null;
  createdAt: Date;
}

const typeIcons: Record<string, React.ReactNode> = {
  COPY: <FileText className="h-4 w-4" />,
  CTA: <MousePointer className="h-4 w-4" />,
  CREATIVE: <Sparkles className="h-4 w-4" />,
  ANGLE: <Target className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
  COPY: "Copy",
  CTA: "CTA",
  CREATIVE: "Criativo",
  ANGLE: "Ângulo",
  BUDGET: "Orçamento",
  TARGETING: "Segmentação",
};

export function SuggestionsView({
  suggestions: initial,
  campaigns,
}: {
  suggestions: Suggestion[];
  campaigns: { id: string; name: string; channel: string }[];
}) {
  const [suggestions, setSuggestions] = useState(initial);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [generating, startGenerate] = useTransition();
  const [filter, setFilter] = useState<string>("PENDING");

  const handleAction = async (id: string, action: "ACCEPTED" | "DISCARDED") => {
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: action } : s))
        );
        toast.success(action === "ACCEPTED" ? "Sugestão aceita!" : "Sugestão descartada");
      }
    } catch {
      toast.error("Erro ao atualizar sugestão");
    }
  };

  const handleGenerate = () => {
    if (!selectedCampaign) {
      toast.error("Selecione uma campanha primeiro");
      return;
    }
    startGenerate(async () => {
      try {
        const res = await fetch("/api/suggestions/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: selectedCampaign }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSuggestions((prev) => [...data.suggestions, ...prev]);
        toast.success(`${data.suggestions.length} sugestões geradas!`);
      } catch {
        toast.error("Erro ao gerar sugestões. Verifique sua chave Anthropic.");
      }
    });
  };

  const filtered = suggestions.filter((s) => filter === "ALL" || s.status === filter);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Campanha para gerar
          </label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4" />
          )}
          Gerar Sugestões com IA
        </Button>

        <div className="ml-auto flex gap-1">
          {["PENDING", "ACCEPTED", "DISCARDED", "ALL"].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === "ALL" ? "Todos" : f === "PENDING" ? "Pendentes" : f === "ACCEPTED" ? "Aceitos" : "Descartados"}
            </Button>
          ))}
        </div>
      </div>

      {/* Suggestions grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-16 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma sugestão encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma campanha e clique em gerar
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((s, i) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={
                  s.status === "ACCEPTED" ? "border-green-500/30" :
                  s.status === "DISCARDED" ? "border-border/30 opacity-60" : ""
                }>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {typeIcons[s.type] ?? <Lightbulb className="h-4 w-4" />}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[s.type] ?? s.type}
                        </Badge>
                      </div>
                      {s.confidence && (
                        <span className="text-xs text-muted-foreground">
                          {(s.confidence * 100).toFixed(0)}% conf.
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm mt-2">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {s.content}
                    </p>
                    {s.rationale && (
                      <p className="text-xs text-muted-foreground/70 italic border-l-2 border-primary/30 pl-2">
                        {s.rationale}
                      </p>
                    )}
                    {s.campaign && (
                      <p className="text-xs text-muted-foreground">
                        📍 {s.campaign.name}
                      </p>
                    )}

                    {s.status === "PENDING" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-green-500/30 text-green-500 hover:bg-green-500/10"
                          onClick={() => handleAction(s.id, "ACCEPTED")}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
                          onClick={() => handleAction(s.id, "DISCARDED")}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> Descartar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
