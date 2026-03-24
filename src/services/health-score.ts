import { db } from "@/lib/db";
import { withCache, CACHE_KEYS } from "@/lib/redis";
import type { ScoreWeights, HealthScoreData } from "@/types";

const DEFAULT_WEIGHTS: ScoreWeights = {
  ctr: 0.2,
  cpc: 0.2,
  cpl: 0.2,
  conversion: 0.2,
  roas: 0.2,
};

// Industry benchmarks for scoring normalization
const BENCHMARKS = {
  ctr: { excellent: 3.5, good: 2.0, poor: 0.5 }, // %
  cpc: { excellent: 0.5, good: 2.0, poor: 8.0 }, // R$ (inverted)
  cpl: { excellent: 10, good: 50, poor: 200 }, // R$ (inverted)
  conversion: { excellent: 5, good: 2, poor: 0.5 }, // %
  roas: { excellent: 8, good: 3, poor: 1 },
};

function scoreMetric(
  value: number | null,
  key: keyof typeof BENCHMARKS,
  inverted = false
): number {
  if (value === null || isNaN(value)) return 50; // neutral if no data

  const bench = BENCHMARKS[key];

  if (!inverted) {
    if (value >= bench.excellent) return 100;
    if (value >= bench.good)
      return (
        60 +
        ((value - bench.good) / (bench.excellent - bench.good)) * 40
      );
    if (value >= bench.poor)
      return (
        20 +
        ((value - bench.poor) / (bench.good - bench.poor)) * 40
      );
    return Math.max(0, (value / bench.poor) * 20);
  } else {
    // inverted: lower is better (cpc, cpl)
    if (value <= bench.excellent) return 100;
    if (value <= bench.good)
      return (
        60 +
        ((bench.good - value) / (bench.good - bench.excellent)) * 40
      );
    if (value <= bench.poor)
      return (
        20 +
        ((bench.poor - value) / (bench.poor - bench.good)) * 40
      );
    return Math.max(0, 20 - ((value - bench.poor) / bench.poor) * 20);
  }
}

export async function computeHealthScore(
  workspaceId: string,
  campaignId?: string,
  period = "30d"
): Promise<HealthScoreData[]> {
  return withCache(
    CACHE_KEYS.healthScore(workspaceId, campaignId),
    async () => {
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { scoreWeights: true },
      });

      const weights =
        (workspace?.scoreWeights as ScoreWeights) ?? DEFAULT_WEIGHTS;

      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const where = {
        workspaceId,
        ...(campaignId ? { campaignId } : {}),
        date: { gte: since },
      };

      const campaigns = await db.campaign.findMany({
        where: { workspaceId, ...(campaignId ? { id: campaignId } : {}) },
        include: {
          metrics: {
            where: { date: { gte: since } },
          },
        },
      });

      return campaigns.map((campaign) => {
        const metrics = campaign.metrics;

        const totals = metrics.reduce(
          (acc, m) => ({
            impressions: acc.impressions + (m.impressions ?? 0),
            clicks: acc.clicks + (m.clicks ?? 0),
            leads: acc.leads + (m.leads ?? 0),
            conversions: acc.conversions + (m.conversions ?? 0),
            spend: acc.spend + (m.spend ?? 0),
            revenue: acc.revenue + (m.revenue ?? 0),
          }),
          { impressions: 0, clicks: 0, leads: 0, conversions: 0, spend: 0, revenue: 0 }
        );

        const ctr =
          totals.impressions > 0
            ? (totals.clicks / totals.impressions) * 100
            : null;
        const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null;
        const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
        const conv =
          totals.clicks > 0
            ? (totals.conversions / totals.clicks) * 100
            : null;
        const roas = totals.spend > 0 ? totals.revenue / totals.spend : null;

        const ctrScore = scoreMetric(ctr, "ctr");
        const cpcScore = scoreMetric(cpc, "cpc", true);
        const cplScore = scoreMetric(cpl, "cpl", true);
        const convScore = scoreMetric(conv, "conversion");
        const roasScore = scoreMetric(roas, "roas");

        const score = Math.round(
          ctrScore * weights.ctr +
            cpcScore * weights.cpc +
            cplScore * weights.cpl +
            convScore * weights.conversion +
            roasScore * weights.roas
        );

        const breakdown = [
          { metric: "ctr", label: "CTR", value: ctr ?? 0, weight: weights.ctr, score: ctrScore },
          { metric: "cpc", label: "CPC", value: cpc ?? 0, weight: weights.cpc, score: cpcScore },
          { metric: "cpl", label: "CPL", value: cpl ?? 0, weight: weights.cpl, score: cplScore },
          { metric: "conversion", label: "Conv. Rate", value: conv ?? 0, weight: weights.conversion, score: convScore },
          { metric: "roas", label: "ROAS", value: roas ?? 0, weight: weights.roas, score: roasScore },
        ];

        const explanation = generateExplanation(campaign.name, score, breakdown, {
          ctr,
          cpc,
          cpl,
          conv,
          roas,
        });

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          channel: campaign.channel,
          score,
          explanation,
          breakdown,
        };
      });
    },
    300
  );
}

function generateExplanation(
  name: string,
  score: number,
  breakdown: { metric: string; label: string; score: number }[],
  values: Record<string, number | null>
): string {
  const weak = breakdown.filter((b) => b.score < 40).map((b) => b.label);
  const strong = breakdown.filter((b) => b.score >= 80).map((b) => b.label);

  let text = `${name} — ${score}/100. `;

  if (score >= 80) text += "Performance excelente. ";
  else if (score >= 60) text += "Performance boa, com margem de melhoria. ";
  else if (score >= 40) text += "Performance regular — atenção necessária. ";
  else text += "Performance crítica — ação imediata recomendada. ";

  if (strong.length > 0) text += `Pontos fortes: ${strong.join(", ")}. `;
  if (weak.length > 0) text += `Pontos críticos: ${weak.join(", ")}. `;

  if (values.cpl && values.cpl > 100) {
    text += `CPL de R$${values.cpl.toFixed(2)} acima do benchmark — considere revisar segmentação. `;
  }
  if (values.roas && values.roas < 2) {
    text += `ROAS de ${values.roas.toFixed(1)}x abaixo do ideal — revise criativos e landing pages. `;
  }

  return text.trim();
}

export async function saveHealthScores(
  workspaceId: string,
  scores: HealthScoreData[]
) {
  await db.healthScore.createMany({
    data: scores.map((s) => ({
      workspaceId,
      campaignId: s.campaignId,
      score: s.score,
      period: "30d",
      explanation: s.explanation,
      breakdown: s.breakdown as object,
      weights: {},
    })),
  });
}
