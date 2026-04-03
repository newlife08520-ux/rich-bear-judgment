/**
 * P0 決策工作台：狀態常數、Saved Views、規則引擎（前端可運作）
 * 資料來源標註：API / 前端推導 / mock
 */

// --- 狀態標籤（商品）---
export const PRODUCT_STATUS = {
  scale: "加碼",
  watch: "觀察",
  danger: "危險",
  stop: "停損",
} as const;
export type ProductStatusKey = keyof typeof PRODUCT_STATUS;

// --- 狀態標籤（素材）---
export const CREATIVE_STATUS = {
  keep: "保留",
  test: "續測",
  close: "關閉",
  remake: "重製",
  fatigue: "疲勞",
  winner: "勝出",
  need_new: "需補新素材",
} as const;
export type CreativeStatusKey = keyof typeof CREATIVE_STATUS;

// --- 狀態標籤（任務）---
export const TASK_STATUS = {
  unassigned: "未指派",
  assigned: "已指派",
  in_progress: "進行中",
  done: "已完成",
  pending_confirm: "待確認",
} as const;
export type TaskStatusKey = keyof typeof TASK_STATUS;

// --- Saved View IDs ---
export const SAVED_VIEW_IDS = [
  "boss_brief",
  "media_today",
  "high_potential",
  "low_roas_stop",
  "creative_fatigue",
  "new_creative_test",
] as const;
export type SavedViewId = (typeof SAVED_VIEW_IDS)[number];

export const SAVED_VIEW_LABELS: Record<SavedViewId, string> = {
  boss_brief: "老闆晨會",
  media_today: "投手今日待辦",
  high_potential: "高潛力加碼",
  low_roas_stop: "低 ROAS 停損",
  creative_fatigue: "素材疲勞汰換",
  new_creative_test: "新素材續測",
};

// --- 規則門檻（可調）---
const SPEND_THRESHOLD_STOP = 1500;
const ROAS_TARGET_MIN = 1.0;
const ROAS_SCALE_MIN = 2.5;
const CTR_HIGH = 2.5;
const FREQUENCY_FATIGUE = 8;
const MIN_SPEND_FOR_RULES = 300;

export interface ProductRowInput {
  productName: string;
  spend: number;
  revenue: number;
  roas: number;
  impressions: number;
  clicks: number;
  conversions: number;
  campaignCount?: number;
}

export interface ProductRowDerived {
  productName: string;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
  productStatus: ProductStatusKey;
  aiSuggestion: string;
  ruleTags: string[];
}

/** 從 productLevel 推導 CTR/CVR/CPC/CPA 與狀態、規則標籤 */
export function deriveProductRow(p: ProductRowInput): ProductRowDerived {
  const ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
  const cvr = p.clicks > 0 ? (p.conversions / p.clicks) * 100 : 0;
  const cpc = p.clicks > 0 ? p.spend / p.clicks : 0;
  const cpa = p.conversions > 0 ? p.spend / p.conversions : 0;

  const ruleTags: string[] = [];
  let productStatus: ProductStatusKey = "watch";

  if (p.spend >= SPEND_THRESHOLD_STOP && p.roas < ROAS_TARGET_MIN) {
    ruleTags.push("停損候選");
    productStatus = "stop";
  } else if (p.roas >= ROAS_SCALE_MIN && p.spend > 1000) {
    ruleTags.push("建議加碼");
    productStatus = "scale";
  } else if (p.spend >= MIN_SPEND_FOR_RULES && p.roas < ROAS_TARGET_MIN) {
    ruleTags.push("危險");
    productStatus = "danger";
  }

  if (ctr >= CTR_HIGH && cvr < 2 && p.clicks > 50) ruleTags.push("疑頁面/疑受眾");
  if (ctr < 1 && cpc > 5 && p.spend > 500) ruleTags.push("素材問題優先");

  let aiSuggestion = "";
  if (productStatus === "stop") aiSuggestion = "建議立即停損或關閉";
  else if (productStatus === "scale") aiSuggestion = "受眾未飽和，建議加碼";
  else if (productStatus === "danger") aiSuggestion = "ROAS 偏低，建議觀察或縮預算";
  else aiSuggestion = "持續觀察";

  return {
    productName: p.productName,
    ctr,
    cvr,
    cpc,
    cpa,
    productStatus,
    aiSuggestion,
    ruleTags,
  };
}

export interface CreativeRowInput {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  impressions?: number;
  clicks?: number;
  frequency?: number;
  campaignCount?: number;
}

export interface CreativeRowDerived {
  productName: string;
  materialStrategy: string;
  headlineSnippet: string;
  creativeStatus: CreativeStatusKey;
  ruleTags: string[];
  ctr: number;
  cpc: number;
  cvr: number;
}

/** 從 creativeLeaderboard 單筆推導狀態與規則（需同商品其他素材做 winner/需補新素材） */
export function deriveCreativeRow(
  c: CreativeRowInput,
  sameProductCreatives: CreativeRowInput[]
): CreativeRowDerived {
  const impressions = c.impressions ?? 0;
  const clicks = c.clicks ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? c.spend / clicks : 0;
  const cvr = clicks > 0 ? (c.conversions / clicks) * 100 : 0;
  const frequency = c.frequency ?? 0;

  const ruleTags: string[] = [];
  let creativeStatus: CreativeStatusKey = "test";

  if (c.spend >= MIN_SPEND_FOR_RULES && c.roas < ROAS_TARGET_MIN) {
    ruleTags.push("低效");
    creativeStatus = "close";
  } else if (c.roas >= ROAS_SCALE_MIN && c.spend > 200) {
    ruleTags.push("勝出候選");
    creativeStatus = "winner";
  }

  if (frequency >= FREQUENCY_FATIGUE && ctr < 1.5) {
    ruleTags.push("疲勞候選");
    creativeStatus = "fatigue";
  }
  if (c.spend < 100 && c.conversions === 0) {
    ruleTags.push("資料不足");
    creativeStatus = "test";
  }

  const sortedByRoas = [...sameProductCreatives].sort((a, b) => b.roas - a.roas);
  const top2 = sortedByRoas.slice(0, 2);
  const isInTop2 = top2.some(
    (x) => x.materialStrategy === c.materialStrategy && x.headlineSnippet === c.headlineSnippet
  );
  if (isInTop2 && c.roas >= 1.5) creativeStatus = "winner";
  const losers = sameProductCreatives.filter((x) => x.roas < 1 && x.spend > 200);
  if (losers.length >= 2 && sameProductCreatives.length >= 3) {
    const needNew = sameProductCreatives.every((x) => x.roas < 1 || x.spend < 100);
    if (needNew) ruleTags.push("該商品需補新素材");
  }

  return {
    productName: c.productName,
    materialStrategy: c.materialStrategy,
    headlineSnippet: c.headlineSnippet,
    creativeStatus,
    ruleTags,
    ctr,
    cpc,
    cvr,
  };
}

/** 依 Saved View 過濾/排序商品列表（前端）；泛型以支援 ProductBattleRow 等擴充列 */
export function applySavedViewToProducts<
  T extends ProductRowDerived & { spend: number; roas: number },
>(viewId: SavedViewId, rows: T[]): T[] {
  const sorted = [...rows];
  switch (viewId) {
    case "boss_brief":
      return sorted.sort((a, b) => b.spend - a.spend).slice(0, 10);
    case "media_today":
      return sorted.filter((r) => r.productStatus === "danger" || r.productStatus === "stop").sort((a, b) => b.spend - a.spend);
    case "high_potential":
      return sorted.filter((r) => r.productStatus === "scale").sort((a, b) => b.roas - a.roas);
    case "low_roas_stop":
      return sorted.filter((r) => r.productStatus === "stop" || r.productStatus === "danger").sort((a, b) => b.spend - a.spend);
    case "creative_fatigue":
      return sorted;
    case "new_creative_test":
      return sorted;
    default:
      return sorted;
  }
}
