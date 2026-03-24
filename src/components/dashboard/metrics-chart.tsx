"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTheme } from "next-themes";

interface MetricsChartProps {
  data: Array<{
    date: string;
    leads?: number;
    clicks?: number;
    spend?: number;
    conversions?: number;
  }>;
  title?: string;
  description?: string;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-sm">
      <p className="font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString("pt-BR")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function MetricsChart({ data, title = "Métricas", description }: MetricsChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F40202" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F40202" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff5252" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ff5252" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
            />
            {data[0]?.leads !== undefined && (
              <Area
                type="monotone"
                dataKey="leads"
                name="Leads"
                stroke="#F40202"
                strokeWidth={2}
                fill="url(#colorLeads)"
                dot={false}
                activeDot={{ r: 4, fill: "#F40202" }}
              />
            )}
            {data[0]?.clicks !== undefined && (
              <Area
                type="monotone"
                dataKey="clicks"
                name="Cliques"
                stroke="#ff5252"
                strokeWidth={2}
                fill="url(#colorClicks)"
                dot={false}
                activeDot={{ r: 4, fill: "#ff5252" }}
              />
            )}
            {data[0]?.conversions !== undefined && (
              <Area
                type="monotone"
                dataKey="conversions"
                name="Conversões"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorConversions)"
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
