import type { GoalPacingEvaluation, GoalPacingInput, RecommendedPacingAction } from "@shared/goal-pacing-engine";
import { describeGoalPacingMetaSignals, operatorSecondaryNarratives } from "@shared/goal-pacing-engine";

export const RECOMMENDED_ACTION_LABEL: Record<RecommendedPacingAction, string> = {
  raise_goal: "調高目標成果",
  lower_goal: "調低目標成果",
  keep_goal: "維持目標成果",
  increase_budget: "增加預算（次要選項）",
  decrease_budget: "降低預算",
  hold: "暫不動／先觀察",
};

export function formatGoalPacingOneLiner(p: GoalPacingEvaluation): string {
  const act = RECOMMENDED_ACTION_LABEL[p.recommendedAction];
  return `${act} · ${p.pacingLabel} · 信心 ${p.confidence}`;
}

/** 6.6-C：低信心原因 + 為何未更大／更小（取自引擎 why / whyNotMore） */
export function formatGoalPacingClarityLines(
  p: GoalPacingEvaluation,
  input?: GoalPacingInput
): string[] {
  const lines: string[] = [];
  if (input) {
    const { evidenceBasis, missingSignals } = describeGoalPacingMetaSignals(input);
    if (evidenceBasis.length) lines.push("本次主要依據：" + evidenceBasis.join("；"));
    if (missingSignals.length) lines.push("資料不足：" + missingSignals.join("；"));
  }
  lines.push(...p.why);
  if (p.whyNotMore) lines.push(`為何不是更大／更小：${p.whyNotMore}`);
  const sec = operatorSecondaryNarratives(p);
  if (sec.whyHold) lines.push(`Hold 脈絡：${sec.whyHold}`);
  if (sec.whyShrink) lines.push(`縮量脈絡：${sec.whyShrink}`);
  if (sec.whyUnderDelivery) lines.push(`投放／節奏：${sec.whyUnderDelivery}`);
  if (p.copyHints?.length) lines.push(...p.copyHints.map((c) => `提示：${c}`));
  return lines;
}
