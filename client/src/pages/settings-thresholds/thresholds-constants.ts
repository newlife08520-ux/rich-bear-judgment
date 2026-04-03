export const DEFAULT: Record<string, number> = {
  spendThresholdStop: 1500,
  roasTargetMin: 1.0,
  roasScaleMin: 2.5,
  ctrHigh: 2.5,
  frequencyFatigue: 8,
  minSpendForRules: 300,
  minClicks: 50,
  minATC: 3,
  minPurchases: 2,
  minSpend: 300,
  funnelAtcTolerance: 0.2,
  funnelPurchaseTolerance: 0.2,
  luckySpendThreshold: 500,
  luckyMinPurchasesToExclude: 2,
};

export const PERCENT_KEYS = [
  "funnelAtcTolerance",
  "funnelPurchaseTolerance",
] as const;
export const CTR_KEY = "ctrHigh";

export function toPercentDisplay(val: number): string {
  return `${Math.round(val * 100)}%`;
}

export function fromPercentInput(s: string): number {
  const n = parseFloat(s.replace(/%/g, "").trim());
  return Number.isFinite(n) ? n / 100 : 0;
}

export function toPercentInput(val: number): string {
  return String(Math.round(val * 100));
}

export type FieldDef = {
  key: string;
  label: string;
  description: string;
  isPercent?: boolean;
  isRatio?: boolean;
};

export const FIELDS: FieldDef[] = [
  {
    key: "spendThresholdStop",
    label: "停損花費門檻",
    description: "單一廣告達此花費且未達 ROAS 目標時，建議停損。",
  },
  {
    key: "roasTargetMin",
    label: "ROAS 目標下限",
    description: "判定「達標」的最低 ROAS，低於此視為未達標。",
  },
  {
    key: "roasScaleMin",
    label: "加碼 ROAS 門檻",
    description: "達此 ROAS 以上才建議加碼預算。",
  },
  {
    key: "ctrHigh",
    label: "CTR 高標",
    description: "用於判斷素材點擊表現是否優秀。",
    isRatio: true,
  },
  {
    key: "frequencyFatigue",
    label: "疲勞頻率",
    description: "曝光頻率超過此值視為疲勞，建議輪替素材。",
  },
  {
    key: "minSpendForRules",
    label: "規則最低花費",
    description: "達此花費才套用決策規則，避免小預算被誤判。",
  },
  {
    key: "minClicks",
    label: "最低點擊門檻",
    description: "進入 ROI 漏斗計算的最低點擊數。",
  },
  {
    key: "minATC",
    label: "最低加購數門檻",
    description: "進入 ROI 漏斗計算的最低加購數。",
  },
  {
    key: "minPurchases",
    label: "最低購買數門檻",
    description: "進入 ROI 漏斗計算的最低購買數。",
  },
  {
    key: "minSpend",
    label: "ROI 漏斗最低花費",
    description: "進入 ROI 漏斗計算的最低花費；過低易造成 Lucky 誤判。",
  },
  {
    key: "funnelAtcTolerance",
    label: "加購率容許偏差",
    description: "加購率與基準的容差，超過視為漏斗異常。",
    isPercent: true,
  },
  {
    key: "funnelPurchaseTolerance",
    label: "購買率容許偏差",
    description: "購買轉換率與基準的容差。",
    isPercent: true,
  },
  {
    key: "luckySpendThreshold",
    label: "低花費運氣單判定上限",
    description: "花費低於此且轉換好，可能標為 Lucky（需補量驗證）。",
  },
  {
    key: "luckyMinPurchasesToExclude",
    label: "Lucky 排除最少購買數",
    description: "購買數達此以上較不視為純運氣，可排除 Lucky。",
  },
];

export const PRESETS: {
  id: string;
  label: string;
  description: string;
  config: Record<string, number>;
}[] = [
  {
    id: "conservative",
    label: "保守測試",
    description: "門檻較嚴，適合小預算或測試期，減少誤判。",
    config: {
      ...DEFAULT,
      spendThresholdStop: 1000,
      roasTargetMin: 1.5,
      roasScaleMin: 3,
      minClicks: 80,
      minATC: 5,
      minPurchases: 3,
      minSpend: 400,
      funnelAtcTolerance: 0.15,
      funnelPurchaseTolerance: 0.15,
      luckySpendThreshold: 400,
    },
  },
  {
    id: "standard",
    label: "標準測試",
    description: "平衡門檻，適合多數投放情境。",
    config: { ...DEFAULT },
  },
  {
    id: "aggressive",
    label: "積極擴量",
    description: "門檻較鬆，適合已有穩定轉換、要放量時。",
    config: {
      ...DEFAULT,
      spendThresholdStop: 2500,
      roasTargetMin: 0.8,
      roasScaleMin: 2,
      minClicks: 30,
      minATC: 2,
      minPurchases: 1,
      minSpend: 200,
      funnelAtcTolerance: 0.25,
      funnelPurchaseTolerance: 0.25,
      luckySpendThreshold: 600,
    },
  },
];

export function formatDisplayValue(
  key: string,
  val: number,
  def: FieldDef
): string {
  if (def.isPercent) return toPercentDisplay(val);
  if (def.isRatio || key === "ctrHigh") return `${val}%`;
  return String(val);
}
