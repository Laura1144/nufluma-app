"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, formatPercent, getScoreColor, cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface CampaignRow {
  id: string;
  name: string;
  channel: string;
  status: string;
  totals: {
    spend: number;
    leads: number;
    clicks: number;
    conversions: number;
    impressions: number;
  };
  latestScore: number | null;
}

const statusVariant: Record<string, "success" | "warning" | "outline" | "secondary"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  ENDED: "outline",
  DRAFT: "secondary",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
  DRAFT: "Rascunho",
};

export function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">Nenhuma campanha encontrada.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte uma integração ou crie sua primeira campanha.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campanha
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Investimento
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Leads
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                CTR
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                CPL
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Score
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => {
              const ctr =
                c.totals.impressions > 0
                  ? (c.totals.clicks / c.totals.impressions) * 100
                  : 0;
              const cpl =
                c.totals.leads > 0 ? c.totals.spend / c.totals.leads : 0;

              return (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {c.channel.replace("_", " ")}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[c.status] ?? "outline"} className="text-xs">
                      {statusLabel[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {formatCurrency(c.totals.spend)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatNumber(c.totals.leads)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {formatPercent(ctr)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {c.totals.leads > 0 ? formatCurrency(cpl) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.latestScore !== null ? (
                      <span
                        className={cn(
                          "text-sm font-bold",
                          getScoreColor(c.latestScore)
                        )}
                      >
                        {c.latestScore}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Ver <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
