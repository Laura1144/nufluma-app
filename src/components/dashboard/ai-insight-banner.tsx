"use client";

import { useEffect, useState } from "react";
import { Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface AiInsightBannerProps {
  workspaceId: string;
}

export function AiInsightBanner({ workspaceId: _ }: AiInsightBannerProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const res = await fetch("/api/insights/causal?period=30d");
        if (res.ok) {
          const data = await res.json();
          setInsight(data.insight);
        }
      } catch {
        // Silently fail — insight is a bonus feature
      } finally {
        setLoading(false);
      }
    };
    fetchInsight();
  }, []);

  if (!loading && !insight) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4"
      >
        {/* Neon accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {loading ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Insight IA — Análise Causal
            </p>
            {loading ? (
              <div className="space-y-1.5">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {insight}
              </p>
            )}
          </div>

          {!loading && (
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/consultor">
                Ver mais <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
