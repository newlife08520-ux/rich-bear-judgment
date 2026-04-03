export const OBJECTIVE_TO_PREFIX: Record<string, string> = {
  轉換: "轉換次數(原始)",
  觸及: "觸及人數(原始)",
  互動: "互動(原始)",
  品牌知名度: "品牌知名度(原始)",
  訊息: "訊息(原始)",
};

export const META_CTA_OPTIONS = [
  "來去逛逛",
  "了解更多",
  "立即購買",
  "註冊",
  "聯絡我們",
  "下載",
  "申請 now",
  "訂閱",
  "領取優惠",
  "立即預約",
];

export const WIZARD_STEPS = [
  { step: 1 as const, label: "基本設定", short: "帳號／目標／Campaign／預算" },
  { step: 2 as const, label: "素材與版本", short: "選素材包、版本、尺寸類型" },
  { step: 3 as const, label: "投放前檢查", short: "CTA、粉專／IG、落地頁、檢查結果" },
];
