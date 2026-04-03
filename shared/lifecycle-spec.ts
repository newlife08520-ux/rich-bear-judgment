/**
 * 素材生命週期中心 1.0 規格（第三層流程管理引擎）
 *
 * 架構定版（75850e9）：三層架構、華麗熊真源、成功率頁定位、生命週期方向已定。
 * 產品仍未完成，此檔為生命週期 1.0 狀態流與欄位規格，供實作對齊。
 *
 * 狀態流（7 階段）：
 * 待初審 → 待驗證 → 第一次決策點 → 存活池 → 拉升池 → 死亡池 → 靈感池
 */

export const LIFECYCLE_VERSION = "1.0";

/** 生命週期 1.0 七階段 */
export const LIFECYCLE_STAGES = [
  "待初審",
  "待驗證",
  "第一次決策點",
  "存活池",
  "拉升池",
  "死亡池",
  "靈感池",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** 第一次決策點：花費約 750–1000 時做開/拉高/維持/關閉/進延伸池 */
export const FIRST_DECISION_SPEND_MIN = 750;
export const FIRST_DECISION_SPEND_MAX = 1000;

/** 每支素材目標承載欄位（生命週期 1.0） */
export const LIFECYCLE_ASSET_FIELDS = [
  "初審判決",
  "實戰判決",
  "Scale Readiness",
  "預算建議",
  "生死狀態",
  "給設計的借鑑點",
  "給投手的建議動作",
  "whyNotMore",
] as const;

/** 當前 ROI 漏斗 label 與 7 階段對應（供後續實作對齊用） */
export const ROI_LABEL_TO_STAGE: Record<string, LifecycleStage> = {
  NEEDS_MORE_DATA: "待驗證",
  Underfunded: "待驗證",
  Lucky: "死亡池",
  FunnelWeak: "死亡池",
  Retired: "死亡池",
  STABLE: "存活池",
  Winner: "存活池",
};

/** 待初審：花費極低、尚無足夠資料 */
export const PENDING_REVIEW_SPEND_MAX = 100;

/**
 * 依花費、ROI 標籤、Profit Headroom 計算生命週期階段（活動維度）。
 * 第一次決策點：花費在 [750, 1000] 區間。
 */
export function computeLifecycleStage(
  spend: number,
  roiLabel: string,
  profitHeadroom?: number
): LifecycleStage {
  if (spend >= FIRST_DECISION_SPEND_MIN && spend <= FIRST_DECISION_SPEND_MAX) return "第一次決策點";
  if (roiLabel === "Lucky" || roiLabel === "FunnelWeak" || roiLabel === "Retired") return "死亡池";
  if (roiLabel === "Winner") {
    if (profitHeadroom != null && profitHeadroom > 1 && spend > FIRST_DECISION_SPEND_MAX) return "拉升池";
    return "存活池";
  }
  if (roiLabel === "STABLE") return "存活池";
  if (roiLabel === "Underfunded" || roiLabel === "NEEDS_MORE_DATA") {
    if (spend < PENDING_REVIEW_SPEND_MAX) return "待初審";
    return "待驗證";
  }
  return "待驗證";
}
