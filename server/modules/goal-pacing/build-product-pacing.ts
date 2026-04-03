import type { CampaignMetrics } from "@shared/schema";
import type { ProductLevelMetrics } from "@shared/tag-aggregation-engine";
import { parseCampaignNameToTags } from "@shared/tag-aggregation-engine";
import {
  describeGoalPacingMetaSignals,
  evaluateGoalAndPacing,
  operatorSecondaryNarratives,
  type GoalPacingEvaluation,
} from "@shared/goal-pacing-engine";
import { deriveOperatorPacingState } from "@shared/goal-pacing-operator-states";
import { getAdjustRow } from "../creative-intelligence/workbench-adjust-prisma";

function isMetaLearningPhaseProtected(c: Camp | undefined): boolean {
  if (!c) return false;
  const a = (c.metaAdSetEffectiveStatus || "").toUpperCase();
  const b = (c.metaEffectiveStatus || "").toUpperCase();
  return (
    /LEARNING|IN_PROCESS|WITH_ISSUES|PREAPPROVED/i.test(a) ||
    /LEARNING|IN_PROCESS|WITH_ISSUES/i.test(b)
  );
}

type Camp = Pick<
  CampaignMetrics,
  | "campaignId"
  | "campaignName"
  | "spend"
  | "roas"
  | "roasPrev"
  | "clicks"
  | "conversions"
  | "biddingType"
  | "targetOutcomeValue"
  | "spendFullness"
  | "todayAdjustCount"
  | "observationWindowUntil"
  | "lastAdjustType"
  | "metaEffectiveStatus"
  | "metaAdSetEffectiveStatus"
  | "multiWindow"
>;

export async function buildGoalPacingByProduct(
  userId: string,
  productLevel: ProductLevelMetrics[],
  campaignRows: Camp[]
): Promise<Record<string, GoalPacingEvaluation>> {
  const out: Record<string, GoalPacingEvaluation> = {};
  for (const p of productLevel) {
    const row = await getAdjustRow(userId, `product:${p.productName}`);
    const camps = campaignRows.filter((c) => parseCampaignNameToTags(c.campaignName)?.productName === p.productName);
    const top = [...camps].sort((a, b) => b.spend - a.spend)[0];
    const input = {
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      roasPrev: top?.roasPrev,
      spendFullness: top?.spendFullness ?? null,
      biddingType: top?.biddingType ?? null,
      targetOutcomeValue: top?.targetOutcomeValue ?? null,
      todayAdjustCount: row?.adjustCount ?? top?.todayAdjustCount ?? 0,
      observationWindowUntil: row?.observationWindowUntil?.toISOString() ?? top?.observationWindowUntil ?? null,
      lastAdjustType: row?.lastAdjustType ?? top?.lastAdjustType ?? null,
      lowSample: p.spend < 200 && p.clicks < 30,
      conversionsHint: p.conversions,
      learningPhaseProtected: isMetaLearningPhaseProtected(top),
    };
    const ev = evaluateGoalAndPacing(input);
    const meta = describeGoalPacingMetaSignals(input);
    const nar = operatorSecondaryNarratives(ev);
    const enriched: GoalPacingEvaluation = {
      ...ev,
      ingestionGaps: meta.missingSignals,
      operatorPacingState: deriveOperatorPacingState(ev, input),
      operatorExplainability: {
        whyHold: nar.whyHold,
        whyLoosen: nar.whyLoosenTarget,
        whyShrink: nar.whyShrink,
        whyUnderDelivery: nar.whyUnderDelivery,
      },
    };
    out[p.productName] = enriched;
  }
  return out;
}
