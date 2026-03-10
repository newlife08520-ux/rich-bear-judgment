/**
 * 華麗熊 Prompt 五層組裝 — 定版順序
 *
 * 組裝順序固定（不可打亂）：
 * 1. Core Persona（唯一人格真源，server/prompts/rich-bear-core.ts）
 * 2. Hidden Calibration（隱性校準層，server/rich-bear-calibration.ts）
 * 3. Workflow Overlay（clarify | create | audit | strategy | task；audit 時可加 MODE A/B/C/D 焦點）
 * 4. Data Context（本次任務的資料，由呼叫方帶入）
 * 5. Output Schema（僅 audit 工作流時附加結構化評分卡）
 *
 * 人格唯一真源在 Core；Calibration 不取代人格；Workflow 是工作方式，不是第二人格。
 */
import { getBaseCore, getModePrompt, type InternalMode } from "./rich-bear-persona";
import { getHiddenCalibration } from "./rich-bear-calibration";
import { getWorkflowOverlay, type WorkflowKey } from "./rich-bear-workflow-overlays";

export type UIMode = "boss" | "buyer" | "creative";

export type JudgmentType = "creative" | "landing_page" | "fb_ads" | "ga4_funnel" | "extension_ideas";

/** 外層三模式 → 內層模式優先順序（僅在 workflow=audit 時用於「審哪一類」焦點） */
const UI_MODE_TO_INTERNAL: Record<UIMode, InternalMode[]> = {
  boss: ["B", "C", "D"],
  buyer: ["C", "D"],
  creative: ["A", "B"],
};

/** 審判類型 → 內層模式 */
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

/** 工作流定版 5 個：clarify | create | audit | strategy | task */
export type Workflow = WorkflowKey;

export interface AssembleOptions {
  uiMode: UIMode;
  /** 已發布主 prompt（workbench），疊加在 Core 之後、不取代人格 */
  customMainPrompt?: string | null;
  judgmentType?: JudgmentType;
  /** Layer 4：Data Context */
  dataContext?: string | null;
  /** 工作流：決定 Layer 3 overlay 與是否加 Layer 5 評分卡 */
  workflow?: Workflow;
}

/**
 * 五層組裝：Core → Calibration → Workflow Overlay（audit 時加 MODE 焦點）→ Data Context → Output Schema（僅 audit）
 */
export function getAssembledSystemPrompt(options: AssembleOptions): string {
  const { uiMode, customMainPrompt, judgmentType, dataContext, workflow } = options;
  const effectiveWorkflow: Workflow = workflow ?? "clarify";
  const isAudit = effectiveWorkflow === "audit";

  const layer1Core = getBaseCore();
  const publishedOverlay = (customMainPrompt && customMainPrompt.trim()) || "";
  const layer2Calibration = getHiddenCalibration();
  const layer4Data = (dataContext && dataContext.trim()) || "";

  const layer3Parts: string[] = [getWorkflowOverlay(effectiveWorkflow)];
  if (isAudit) {
    const internalModes = judgmentType
      ? judgmentTypeToInternalModes(judgmentType)
      : UI_MODE_TO_INTERNAL[uiMode];
    layer3Parts.push(...internalModes.map((m) => getModePrompt(m)).filter(Boolean));
  }

  const parts = [
    layer1Core,
    ...(publishedOverlay ? [publishedOverlay] : []),
    layer2Calibration,
    ...layer3Parts,
    ...(layer4Data ? [layer4Data] : []),
    ...(isAudit ? [STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION] : []),
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Layer 5：Output Schema。僅 audit 工作流使用。 */
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
