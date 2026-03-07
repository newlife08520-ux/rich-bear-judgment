/**
 * RICH BEAR 審判官 — 片段式組裝，不送兩份全文。
 * 外層三模式（Boss / 投手 / 創意）→ 內層四模式（A/B/C/D）＋ Hidden Calibration。
 */
import { getBaseCore, getModePrompt, type InternalMode } from "./rich-bear-persona";
import {
  CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
  CALIBRATION_SLICE_VISUAL_IMPACT,
  CALIBRATION_SLICE_BRAND_CONVERSION,
  CALIBRATION_SLICE_EXAMPLE,
} from "./rich-bear-calibration";

export type UIMode = "boss" | "buyer" | "creative";

export type JudgmentType = "creative" | "landing_page" | "fb_ads" | "ga4_funnel";

/** 外層三模式 → 內層四模式優先順序（依需求：Boss→B,C,D；投手→C,D；創意→A,B） */
const UI_MODE_TO_INTERNAL: Record<UIMode, InternalMode[]> = {
  boss: ["B", "C", "D"],
  buyer: ["C", "D"],
  creative: ["A", "B"],
};

/** 依 UI 模式決定載入的 calibration 片段（創意=全四；投手=Brand+少量Emotional；Boss=Emotional+Brand） */
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
      return [
        CALIBRATION_SLICE_BRAND_CONVERSION,
        CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
      ];
    case "boss":
      return [
        CALIBRATION_SLICE_EMOTIONAL_TRIGGER,
        CALIBRATION_SLICE_BRAND_CONVERSION,
      ];
    default:
      return [];
  }
}

/** 依審判類型回傳對應內層模式，用於單次任務組裝 */
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
    default:
      return ["A"];
  }
}

export interface AssembleOptions {
  /** 外層模式（Boss / 投手 / 創意） */
  uiMode: UIMode;
  /** 若提供且非空，在 Base Core 之上疊加該 mode 已發布主 prompt（來自 workbench） */
  customMainPrompt?: string | null;
  /** 若提供，僅載入此任務對應的內層模式；否則依 uiMode 載入整包 */
  judgmentType?: JudgmentType;
}

/**
 * 組裝最終 system prompt，順序固定：
 * 1. Base Core（永遠載入，人格靈魂）
 * 2. 該 mode 已發布主 prompt（若有）
 * 3. 對應內層 A/B/C/D 模式片段
 * 4. 對應 Hidden Calibration 片段
 */
export function getAssembledSystemPrompt(options: AssembleOptions): string {
  const { uiMode, customMainPrompt, judgmentType } = options;
  const baseCore = getBaseCore();
  const publishedOverlay = (customMainPrompt && customMainPrompt.trim()) || "";
  const internalModes = judgmentType
    ? judgmentTypeToInternalModes(judgmentType)
    : UI_MODE_TO_INTERNAL[uiMode];
  const modeParts = internalModes.map((m) => getModePrompt(m)).filter(Boolean);
  const calibrationParts = getCalibrationParts(uiMode);
  const parts = [baseCore, ...(publishedOverlay ? [publishedOverlay] : []), ...modeParts, ...calibrationParts];
  return parts.filter(Boolean).join("\n\n");
}

/** 結構化輸出指示：請模型在回覆最後以 ```json 輸出裁決摘要，供前端裁決工作台使用 */
export const STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION = `

【結構化輸出】請在每次回覆的最後，以單一 \`\`\`json 程式碼區塊輸出以下 JSON（可與上方內文重複，無法填寫的欄位可省略或空字串）：
{
  "summary": "一句總判決",
  "nextAction": "先做什麼",
  "problemType": "創意|商品頁|投放|漏斗",
  "recommendTask": true或false,
  "confidence": "高|中|低",
  "reasons": "詳細原因",
  "suggestions": "具體建議",
  "evidence": "證據與指標",
  "impactAmount": "影響金額（例：約 5 萬、NT$10000，可從證據推估）"
}
`;

/** 依審判類型推測建議的 UI 模式（用於預設選單或未指定時） */
export function suggestUIModeFromJudgmentType(judgmentType: JudgmentType): UIMode {
  switch (judgmentType) {
    case "creative":
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
