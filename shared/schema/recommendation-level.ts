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
  immediate: "text-red-700 bg-red-50 border-red-200",
  this_week: "text-amber-700 bg-amber-50 border-amber-200",
  schedule: "text-blue-700 bg-blue-50 border-blue-200",
  low: "text-gray-600 bg-gray-50 border-gray-200",
  ignore: "text-gray-400 bg-gray-50/50 border-gray-100",
};

export function getRecommendationLevel(opportunityScore: number): RecommendationLevel {
  if (opportunityScore >= 21) return "immediate";
  if (opportunityScore >= 14) return "this_week";
  if (opportunityScore >= 8) return "schedule";
  if (opportunityScore >= 1) return "low";
  return "ignore";
}
