"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Comparison {
  metric: string;
  label: string;
  clientValueFormatted: string;
  industryAvgFormatted: string;
  percentile: number;
  status: "above" | "average" | "below";
}

const statusConfig = {
  above: {
    label: "Acima da média",
    icon: TrendingUp,
    color: "text-green-500",
    badge: "success" as const,
  },
  average: {
    label: "Na média",
    icon: Minus,
    color: "text-yellow-500",
    badge: "warning" as const,
  },
  below: {
    label: "Abaixo da média",
    icon: TrendingDown,
    color: "text-red-500",
    badge: "destructive" as const,
  },
};

export function BenchmarkView({ comparisons }: { comparisons: Comparison[] }) {
  const radarData = comparisons.map((c) => ({
    subject: c.label,
    Você: Math.min(100, (c.percentile)).toFixed(0),
    Mercado: 50,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Radar chart */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Visão Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Radar
                name="Você"
                dataKey="Você"
                stroke="#F40202"
                fill="#F40202"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar
                name="Mercado"
                dataKey="Mercado"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted))"
                fillOpacity={0.1}
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <div className="lg:col-span-2 space-y-3">
        {comparisons.map((c, i) => {
          const cfg = statusConfig[c.status];
          const Icon = cfg.icon;

          return (
            <motion.div
              key={c.metric}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", cfg.color)} />
                      <span className="text-sm font-semibold">{c.label}</span>
                    </div>
                    <Badge variant={cfg.badge} className="text-xs">
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sua performance</p>
                      <p className={cn("text-lg font-bold", cfg.color)}>
                        {c.clientValueFormatted}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Média do setor</p>
                      <p className="text-lg font-bold text-muted-foreground">
                        {c.industryAvgFormatted}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Percentil</span>
                      <span>{c.percentile.toFixed(0)}º</span>
                    </div>
                    <Progress
                      value={c.percentile}
                      className={cn(
                        "h-2",
                        c.status === "above" && "[&>div]:bg-green-500",
                        c.status === "average" && "[&>div]:bg-yellow-500",
                        c.status === "below" && "[&>div]:bg-red-500"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
