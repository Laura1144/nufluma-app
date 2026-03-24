"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Zap } from "lucide-react";
import type { Mission } from "@/types";
import { motion } from "framer-motion";

interface MissionsPanelProps {
  missions: Mission[];
}

export function MissionsPanel({ missions }: MissionsPanelProps) {
  if (missions.length === 0) {
    return (
      <Card className="flex items-center justify-center">
        <CardContent className="text-center py-8">
          <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhuma missão ativa
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Missões de Melhoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {missions.map((mission, i) => {
          const progress = Math.min(100, (mission.current / mission.target) * 100);
          const completed = mission.completedAt !== null;

          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className={`h-3.5 w-3.5 shrink-0 ${completed ? "text-green-500" : "text-primary"}`} />
                  <p className="text-sm font-medium truncate">{mission.title}</p>
                </div>
                <Badge
                  variant={completed ? "success" : "outline"}
                  className="shrink-0 text-xs"
                >
                  {completed ? "✓" : `${progress.toFixed(0)}%`}
                </Badge>
              </div>
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {mission.current.toLocaleString("pt-BR")} / {mission.target.toLocaleString("pt-BR")} {mission.metric}
              </p>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
