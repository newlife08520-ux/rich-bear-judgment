/**
 * 華麗熊 Prompt 五層組裝
 *
 * 組裝順序固定（不可打亂）：
 * 1. Immutable Core Persona（人格真源，server/prompts/rich-bear-core.ts）
 * 2. Hidden Calibration（校準層，不改變人格靈魂）
 * 3. Mode Overlay（creative | landing-page | ads-data | funnel | extension-ideas）
 * 4. Data Context（本次任務的資料：商品名、BE/Target ROAS、1d/3d/7d、素材圖等，由呼叫方帶入）
 * 5. Output Schema（結構化輸出格式）
 *
 * 分工：數學與數據判斷由「數據判斷引擎」負責；創意解讀、成交槓桿、素材延伸、設計借鑑由華麗熊人格負責。
 */
import { getBaseCore, getModePrompt, type InternalMode } from "./rich-bear-persona";
import {
  CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
  CALIBRATION_SLICE_VISUAL_IMPACT,
  CALIBRATION_SLICE_BRAND_CONVERSION,
  CALIBRATION_SLICE_EXAMPLE,
} from "./rich-bear-calibration";

export type UIMode = "boss" | "buyer" | "creative";

export type JudgmentType = "creative" | "landing_page" | "fb_ads" | "ga4_funnel" | "extension_ideas";

/** 外層三模式 → 內層模式優先順序 */
const UI_MODE_TO_INTERNAL: Record<UIMode, InternalMode[]> = {
  boss: ["B", "C", "D"],
  buyer: ["C", "D"],
  creative: ["A", "B"],
};

function getCalibrationParts(mode: UIMode): string[] {
  switch (mode) {
    case "creative":
      return [
        CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
        CALIBRATION_SLICE_VISUAL_IMPACT,
        CALIBRATION_SLICE_BRAND_CONVERSION,
        CALIBRATION_SLICE_EXAMPLE,
      ];
    case "buyer":
      return [CALIBRATION_SLICE_BRAND_CONVERSION, CALIBRATION_SLICE_EMOTIONAL_TRIGGER];
    case "boss":
      return [CALIBRATION_SLICE_EMOTIONAL_TRIGGER, CALIBRATION_SLICE_BRAND_CONVERSION];
    default:
      return [];
  }
}

/** 審判類型 → 內層模式（Mode Overlay） */
export function judgmentTypeToInternalModes(judgmentType: JudgmentType): InternalMode[] {
  switch (judgmentType) {
    case "creative":
      return ["A"];
    case "landing_page":
      return ["B"];
    case "fb_ads":
      return ["C"];
    case "ga4_funnel":
      return ["D"];
    case "extension_ideas":
      return ["E"];
    default:
      return ["A"];
  }
}

export interface AssembleOptions {
  uiMode: UIMode;
  /** 已發布主 prompt（workbench），疊加在 Core 之後、不取代人格 */
  customMainPrompt?: string | null;
  judgmentType?: JudgmentType;
  /** Layer 4：Data Context。本次任務的資料（商品名、成本比、BE/Target、1d/3d/7d、ATC、素材圖等），由呼叫方組好字串傳入 */
  dataContext?: string | null;
}

/**
 * 五層組裝：Core → Calibration → Mode Overlay → Data Context → Output Schema
 */
export function getAssembledSystemPrompt(options: AssembleOptions): string {
  const { uiMode, customMainPrompt, judgmentType, dataContext } = options;

  const layer1Core = getBaseCore();
  const publishedOverlay = (customMainPrompt && customMainPrompt.trim()) || "";
  const internalModes = judgmentType
    ? judgmentTypeToInternalModes(judgmentType)
    : UI_MODE_TO_INTERNAL[uiMode];
  const layer3ModeParts = internalModes.map((m) => getModePrompt(m)).filter(Boolean);
  const layer2Calibration = getCalibrationParts(uiMode);
  const layer4Data = (dataContext && dataContext.trim()) || "";

  const parts = [
    layer1Core,
    ...(publishedOverlay ? [publishedOverlay] : []),
    ...layer2Calibration,
    ...layer3ModeParts,
    ...(layer4Data ? [layer4Data] : []),
    STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION,
  ];
  /* 順序：1 Core 2 (published) 3 Calibration 4 Mode 5 Data 6 Output */
  return parts.filter(Boolean).join("\n\n");
}

/** Layer 5：Output Schema。結構化輸出，非人格內容。 */
export const STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION = `

【結構化輸出】請在每次回覆的最後，以單一 \`\`\`json 程式碼區塊輸出以下 JSON（可與上方內文重複，無法填寫的欄位可省略或空字串）。請勿輸出 passed 或 threshold，由系統依 score 與門檻計算通過與否。
{
  "summary": "一句總判決",
  "nextAction": "先做什麼",
  "problemType": "創意|商品頁|投放|漏斗",
  "recommendTask": true或false,
  "confidence": "高|中|低",
  "reasons": "詳細原因",
  "suggestions": "具體建議",
  "evidence": "證據與指標",
  "impactAmount": "影響金額（例：約 5 萬、NT$10000，可從證據推估）",
  "score": 0到100的綜合評分（數字）,
  "blockingReasons": ["阻擋放行的原因1", "原因2"],
  "pendingItems": ["待補事項1", "待辦2"]
}
`;

/** 依審判類型推測建議的 UI 模式 */
export function suggestUIModeFromJudgmentType(judgmentType: JudgmentType): UIMode {
  switch (judgmentType) {
    case "creative":
    case "extension_ideas":
      return "creative";
    case "landing_page":
      return "boss";
    case "fb_ads":
    case "ga4_funnel":
      return "buyer";
    default:
      return "creative";
  }
}

/**
 * 組裝 Data Context 區塊（Layer 4）。呼叫方傳入數據判斷引擎結果與任務資料，供華麗熊輸出創意解讀與延伸建議。
 * 不包含人格與校準，僅為當次任務的資料。
 */
export function buildDataContextSection(context: {
  productName?: string;
  costRatio?: number;
  breakEvenRoas?: number;
  targetRoas?: number;
  profitHeadroom?: number;
  roas1d?: number;
  roas3d?: number;
  roas7d?: number;
  trendCore?: number;
  momentum?: number;
  scaleReadinessScore?: number;
  suggestedAction?: string;
  suggestedPct?: number | string;
  reason?: string;
  whyNotMore?: string;
  atc?: number;
  purchases?: number;
  spend?: number;
  revenue?: number;
  [k: string]: unknown;
}): string {
  const lines: string[] = ["【本任務資料・Data Context】"];
  if (context.productName != null) lines.push(`商品：${context.productName}`);
  if (context.costRatio != null) lines.push(`成本比：${context.costRatio}`);
  if (context.breakEvenRoas != null) lines.push(`保本 ROAS：${context.breakEvenRoas}`);
  if (context.targetRoas != null) lines.push(`目標 ROAS：${context.targetRoas}`);
  if (context.profitHeadroom != null) lines.push(`Profit Headroom：${context.profitHeadroom}`);
  if (context.roas1d != null || context.roas3d != null || context.roas7d != null) {
    lines.push(`1d/3d/7d ROAS：${context.roas1d ?? "-"} / ${context.roas3d ?? "-"} / ${context.roas7d ?? "-"}`);
  }
  if (context.trendCore != null) lines.push(`TrendCore：${context.trendCore}`);
  if (context.momentum != null) lines.push(`Momentum：${context.momentum}`);
  if (context.scaleReadinessScore != null) lines.push(`Scale Readiness：${context.scaleReadinessScore}`);
  if (context.suggestedAction != null) lines.push(`建議動作：${context.suggestedAction}`);
  if (context.suggestedPct != null) lines.push(`建議幅度：${context.suggestedPct}`);
  if (context.reason != null) lines.push(`原因：${context.reason}`);
  if (context.whyNotMore != null) lines.push(`為什麼不是更大或更小：${context.whyNotMore}`);
  if (context.atc != null) lines.push(`ATC：${context.atc}`);
  if (context.purchases != null) lines.push(`購買數：${context.purchases}`);
  if (context.spend != null) lines.push(`花費：${context.spend}`);
  if (context.revenue != null) lines.push(`營收：${context.revenue}`);
  return lines.join("\n");
}
