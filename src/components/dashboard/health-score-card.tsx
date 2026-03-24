"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getScoreColor, getScoreLabel } from "@/lib/utils";
import type { HealthScoreData } from "@/types";
import { motion } from "framer-motion";

interface HealthScoreCardProps {
  data: HealthScoreData;
  index?: number;
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? "#22c55e"
    : score >= 60 ? "#eab308"
    : score >= 40 ? "#f97316"
    : "#ef4444";

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="absolute -rotate-90" width="96" height="96" viewBox="0 0 96 96">
        {/* Background circle */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        {/* Score arc */}
        <motion.circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <span className={cn("text-xl font-bold", getScoreColor(score))}>
          {score}
        </span>
      </motion.div>
    </div>
  );
}

export function HealthScoreCard({ data, index = 0 }: HealthScoreCardProps) {
  const scoreLabel = getScoreLabel(data.score);
  const scoreColorClass = getScoreColor(data.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="overflow-hidden hover:border-border/80 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">
                {data.campaignName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {data.channel.replace("_", " ")}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0 text-xs", scoreColorClass)}
            >
              {scoreLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            <ScoreGauge score={data.score} />

            <div className="flex-1 space-y-2">
              {data.breakdown.slice(0, 3).map((b) => (
                <div key={b.metric} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">
                    {b.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor:
                          b.score >= 80 ? "#22c55e"
                          : b.score >= 60 ? "#eab308"
                          : b.score >= 40 ? "#f97316"
                          : "#ef4444",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${b.score}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">
                    {b.score.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {data.explanation}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
