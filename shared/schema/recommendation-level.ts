/**
 * 建議優先級（Priority Engine）— 自 schema.ts 拆出之第一刀（Batch 15.9 schema debt A）。
 */
export const recommendationLevels = ["immediate", "this_week", "schedule", "low", "ignore"] as const;
export type RecommendationLevel = (typeof recommendationLevels)[number];

export const recommendationLevelLabels: Record<RecommendationLevel, string> = {
  immediate: "立即處理",
  this_week: "本週優先",
  schedule: "可安排優化",
  low: "低優先級",
  ignore: "暫不處理",
};

export const recommendationLevelColors: Record<RecommendationLevel, string> = {
  immediate:
    "text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/50",
  this_week:
    "text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/50",
  schedule:
    "text-indigo-700 bg-indigo-50 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800/50",
  low: "text-slate-600 bg-slate-100 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  ignore: "text-slate-500 bg-slate-50 border border-slate-200 dark:bg-muted/50 dark:text-muted-foreground dark:border-border",
};

export function getRecommendationLevel(opportunityScore: number): RecommendationLevel {
  if (opportunityScore >= 21) return "immediate";
  if (opportunityScore >= 14) return "this_week";
  if (opportunityScore >= 8) return "schedule";
  if (opportunityScore >= 1) return "low";
  return "ignore";
}
