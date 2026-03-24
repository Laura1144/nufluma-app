"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getSeverityColor, cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Alert } from "@/types";

interface AlertWithCampaign extends Alert {
  campaign: { name: string; channel: string } | null;
}

interface AlertCenterProps {
  alerts: AlertWithCampaign[];
  counts: { active: number; acknowledged: number; resolved: number };
}

const severityIcons: Record<string, React.ReactNode> = {
  CRITICAL: <AlertTriangle className="h-4 w-4 text-red-500" />,
  HIGH: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  MEDIUM: <Bell className="h-4 w-4 text-yellow-500" />,
  LOW: <Bell className="h-4 w-4 text-blue-500" />,
};

function AlertItem({ alert, onAck }: { alert: AlertWithCampaign; onAck: (id: string) => void }) {
  const [pending, startTransition] = useTransition();

  const handleAck = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/alerts/${alert.id}/acknowledge`, {
          method: "POST",
        });
        if (res.ok) {
          onAck(alert.id);
          toast.success("Alerta confirmado");
        }
      } catch {
        toast.error("Erro ao confirmar alerta");
      }
    });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className={cn("border-l-4", getSeverityColor(alert.severity).includes("red") ? "border-l-red-500" : getSeverityColor(alert.severity).includes("orange") ? "border-l-orange-500" : getSeverityColor(alert.severity).includes("yellow") ? "border-l-yellow-500" : "border-l-blue-500")}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{severityIcons[alert.severity]}</div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">
                  {alert.title}
                </p>
                <Badge
                  className={cn("text-xs", getSeverityColor(alert.severity))}
                  variant="outline"
                >
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              {alert.campaign && (
                <p className="text-xs text-muted-foreground">
                  Campanha: {alert.campaign.name} ({alert.campaign.channel})
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(alert.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>

            {alert.status === "ACTIVE" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAck}
                disabled={pending}
                className="shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Confirmar
              </Button>
            )}
            {alert.status === "ACKNOWLEDGED" && (
              <Badge variant="outline" className="text-xs shrink-0">
                <Clock className="h-3 w-3 mr-1" />
                Confirmado
              </Badge>
            )}
            {alert.status === "RESOLVED" && (
              <Badge variant="success" className="text-xs shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolvido
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AlertCenter({ alerts: initialAlerts, counts }: AlertCenterProps) {
  const [alerts, setAlerts] = useState(initialAlerts);

  const handleAck = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "ACKNOWLEDGED" as const, acknowledgedAt: new Date() } : a
      )
    );
  };

  const byStatus = {
    ACTIVE: alerts.filter((a) => a.status === "ACTIVE"),
    ACKNOWLEDGED: alerts.filter((a) => a.status === "ACKNOWLEDGED"),
    RESOLVED: alerts.filter((a) => a.status === "RESOLVED"),
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-500/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.active}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.acknowledged}</p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolvidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ACTIVE">
        <TabsList>
          <TabsTrigger value="ACTIVE">
            Ativos ({counts.active})
          </TabsTrigger>
          <TabsTrigger value="ACKNOWLEDGED">
            Confirmados ({counts.acknowledged})
          </TabsTrigger>
          <TabsTrigger value="RESOLVED">
            Histórico ({counts.resolved})
          </TabsTrigger>
        </TabsList>

        {(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const).map((status) => (
          <TabsContent key={status} value={status} className="mt-4 space-y-3">
            <AnimatePresence mode="popLayout">
              {byStatus[status].length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum alerta {status === "ACTIVE" ? "ativo" : status === "ACKNOWLEDGED" ? "confirmado" : "no histórico"}
                  </p>
                </div>
              ) : (
                byStatus[status].map((alert) => (
                  <AlertItem key={alert.id} alert={alert} onAck={handleAck} />
                ))
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
