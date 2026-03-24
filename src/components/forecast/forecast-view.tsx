"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ForecastDataPoint } from "@/types";

interface Campaign {
  id: string;
  name: string;
  channel: string;
}

interface ForecastViewProps {
  campaigns: Campaign[];
  workspaceId: string;
}

const METRICS = [
  { value: "leads", label: "Leads" },
  { value: "conversions", label: "Conversões" },
  { value: "spend", label: "Investimento" },
  { value: "revenue", label: "Receita" },
];

export function ForecastView({ campaigns }: ForecastViewProps) {
  const [selectedCampaign, setSelectedCampaign] = useState(campaigns[0]?.id ?? "");
  const [selectedMetric, setSelectedMetric] = useState("leads");
  const [data, setData] = useState<ForecastDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generateForecast = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/forecast?campaignId=${selectedCampaign}&metric=${selectedMetric}`
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
      setGenerated(true);
    } catch {
      toast.error("Erro ao gerar forecast. Verifique os dados da campanha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Campanha</label>
              <Select
                value={selectedCampaign}
                onValueChange={setSelectedCampaign}
                disabled={campaigns.length === 0}
              >
                <SelectTrigger className="w-56">
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Métrica</label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateForecast}
              disabled={!selectedCampaign || loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : generated ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              {generated ? "Atualizar" : "Gerar Forecast"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Previsão — {METRICS.find((m) => m.value === selectedMetric)?.label}
                </CardTitle>
                <CardDescription>
                  Próximos 30 dias com intervalo de confiança 95%
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
                IC 95%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F40202" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#F40202" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />

                {/* Confidence interval band */}
                <Area
                  dataKey="upper"
                  name="Limite Superior"
                  fill="url(#confidenceFill)"
                  stroke="none"
                  legendType="none"
                />
                <Area
                  dataKey="lower"
                  name="Limite Inferior"
                  fill="white"
                  stroke="none"
                  legendType="none"
                />

                {/* Forecast line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Previsão"
                  stroke="#F40202"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#F40202" }}
                />

                {/* Actual data (if available) */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Real"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={{ r: 3, fill: "#22c55e" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!generated && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-16 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione uma campanha e gere o forecast</p>
          <p className="text-sm text-muted-foreground mt-1">
            O modelo de regressão linear usa os últimos 90 dias de dados
          </p>
        </div>
      )}
    </div>
  );
}
