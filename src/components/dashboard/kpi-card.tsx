"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon?: ReactNode;
  description?: string;
  className?: string;
  index?: number;
}

export function KpiCard({
  title,
  value,
  trend,
  trendLabel,
  icon,
  description,
  className,
  index = 0,
}: KpiCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const isNeutral = trend === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Card className={cn("relative overflow-hidden transition-all hover:shadow-md hover:border-border/80", className)}>
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 h-24 w-24 bg-primary/5 rounded-bl-full" />

        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {value}
              </p>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>

            {icon && (
              <div className="relative ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                {icon}
              </div>
            )}
          </div>

          {trend !== undefined && (
            <div className="mt-3 flex items-center gap-1.5">
              {isPositive && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
              {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
              {isNeutral && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
              <span
                className={cn(
                  "text-xs font-medium",
                  isPositive && "text-green-500",
                  isNegative && "text-red-500",
                  isNeutral && "text-muted-foreground"
                )}
              >
                {isPositive ? "+" : ""}{trend.toFixed(1)}%
              </span>
              {trendLabel && (
                <span className="text-xs text-muted-foreground">{trendLabel}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
