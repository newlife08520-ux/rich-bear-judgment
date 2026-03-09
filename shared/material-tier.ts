/**
 * 素材分級：避免 0 花費／樣本不足進入黑榜，並支援 8:2 排序（營收貢獻 + 潛力）
 */

export type MaterialTier = "Winner" | "Potential" | "Borderline" | "Loser" | "Unproven";

export const MATERIAL_TIER_LABELS: Record<MaterialTier, string> = {
  Winner: "贏家",
  Potential: "潛力股",
  Borderline: "觀察中",
  Loser: "成效差",
  Unproven: "樣本不足",
};

/** 列入黑榜/成效判斷的最小門檻：低於此視為 Unproven，不判為 Loser */
export const MIN_SPEND_FOR_LOSER = 100;
export const MIN_IMPRESSIONS_FOR_JUDGMENT = 1000;
/** 若點擊很少且零轉換，視為未驗證 */
export const MIN_CLICKS_OR_CONVERSIONS = 30;

/** ROAS 達標門檻（用於 Winner/Potential） */
export const ROAS_TARGET_DEFAULT = 1.5;

/**
 * 判斷素材分級
 * - Unproven: 未投遞或樣本不足，不可列入黑榜或「成效最差」
 * - Loser: 已達樣本且 ROAS 差
 * - Borderline: 已達樣本，ROAS 一般
 * - Potential: 已達樣本、ROAS 達標、花費占比低（可擴量）
 * - Winner: 已達樣本、ROAS 達標、營收貢獻高（8:2 頭部）
 */
export function classifyMaterialTier(
  spend: number,
  impressions: number,
  clicks: number,
  conversions: number,
  roas: number,
  revenue: number,
  totalRevenue: number,
  roasTarget: number = ROAS_TARGET_DEFAULT
): MaterialTier {
  const hasMinSample =
    spend >= MIN_SPEND_FOR_LOSER &&
    impressions >= MIN_IMPRESSIONS_FOR_JUDGMENT &&
    (clicks >= MIN_CLICKS_OR_CONVERSIONS || conversions > 0);

  if (!hasMinSample) return "Unproven";

  if (roas < 1) return "Loser";
  if (roas < roasTarget) return "Borderline";

  const revenueShare = totalRevenue > 0 ? revenue / totalRevenue : 0;
  if (revenueShare >= 0.1) return "Winner";
  return "Potential";
}
