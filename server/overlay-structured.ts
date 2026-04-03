/**
 * Overlay 結構化欄位最小版
 * Boss / 投手 / 創意 各 3–4 個關鍵欄位，組裝成一段視角補充文字供 prompt 使用。
 */

export type BossOverlayStruct = {
  /** 摘要優先順序（多選，依序） */
  summaryOrder?: string[];
  /** 摘要長度 */
  summaryLength?: "short" | "medium" | "full";
  /** 是否先顯示風險 */
  showRiskFirst?: boolean;
  /** 建議動作出現位置 */
  suggestionPosition?: "first_paragraph" | "with_conclusion" | "separate_block";
};

export type BuyerOverlayStruct = {
  /** 預設展開區塊（rescue / scale_up / no_misjudge / extend 等） */
  defaultExpand?: string[];
  /** 排序偏好（ROAS / CVR / 花費 / 轉換數 / 素材健康度） */
  sortPreference?: string[];
  /** 優先層級 */
  priorityLevel?: "campaign" | "product" | "creative";
  /** whyNotMore 呈現方式 */
  whyNotMoreStyle?: "one_line" | "paragraph" | "with_suggestion";
};

export type CreativeOverlayStruct = {
  /** 先看維度（鉤子 / 前3秒 / 首圖 / 字幕 / CTA） */
  lookAtFirst?: string[];
  /** 產出形式 */
  outputForm?: "three_directions" | "one_full" | "parallel";
  /** 輸出偏向：創作（直接給文案腳本）vs 改稿建議（先點問題再給改法） */
  outputStyle?: "create" | "revise";
};

export type OverlayStruct = BossOverlayStruct | BuyerOverlayStruct | CreativeOverlayStruct;

const SUMMARY_LENGTH_LABEL: Record<string, string> = {
  short: "簡短（1–3 行）",
  medium: "中等",
  full: "完整",
};
const SUGGESTION_POSITION_LABEL: Record<string, string> = {
  first_paragraph: "第一段",
  with_conclusion: "與結論並列",
  separate_block: "獨立區塊",
};
const PRIORITY_LEVEL_LABEL: Record<string, string> = {
  campaign: "campaign",
  product: "product",
  creative: "creative",
};
const WHY_NOT_MORE_LABEL: Record<string, string> = {
  one_line: "簡短一句",
  paragraph: "獨立段",
  with_suggestion: "與建議動作合併",
};
const OUTPUT_FORM_LABEL: Record<string, string> = {
  three_directions: "先給 3 方向",
  one_full: "1 完整版",
  parallel: "並行",
};
const OUTPUT_STYLE_LABEL: Record<string, string> = {
  create: "創作（直接給文案腳本）",
  revise: "改稿建議（先點問題再給改法）",
};

function bossStructToLines(s: BossOverlayStruct): string[] {
  const lines: string[] = [];
  if (s.summaryOrder?.length) lines.push(`摘要優先順序：${s.summaryOrder.join("、")}。`);
  if (s.summaryLength) lines.push(`摘要長度：${SUMMARY_LENGTH_LABEL[s.summaryLength] ?? s.summaryLength}。`);
  if (s.showRiskFirst !== undefined) lines.push(`先顯示風險：${s.showRiskFirst ? "是" : "否"}。`);
  if (s.suggestionPosition) lines.push(`建議動作出現位置：${SUGGESTION_POSITION_LABEL[s.suggestionPosition] ?? s.suggestionPosition}。`);
  return lines;
}

function buyerStructToLines(s: BuyerOverlayStruct): string[] {
  const lines: string[] = [];
  if (s.defaultExpand?.length) lines.push(`預設展開區塊：${s.defaultExpand.join("、")}。`);
  if (s.sortPreference?.length) lines.push(`排序偏好：${s.sortPreference.join("、")}。`);
  if (s.priorityLevel) lines.push(`優先層級：${PRIORITY_LEVEL_LABEL[s.priorityLevel] ?? s.priorityLevel}。`);
  if (s.whyNotMoreStyle) lines.push(`whyNotMore 呈現：${WHY_NOT_MORE_LABEL[s.whyNotMoreStyle] ?? s.whyNotMoreStyle}。`);
  return lines;
}

function creativeStructToLines(s: CreativeOverlayStruct): string[] {
  const lines: string[] = [];
  if (s.lookAtFirst?.length) lines.push(`先看維度：${s.lookAtFirst.join("、")}。`);
  if (s.outputForm) lines.push(`產出形式：${OUTPUT_FORM_LABEL[s.outputForm] ?? s.outputForm}。`);
  if (s.outputStyle) lines.push(`輸出偏向：${OUTPUT_STYLE_LABEL[s.outputStyle] ?? s.outputStyle}。`);
  return lines;
}

/**
 * 將結構化欄位 + 自由補充組裝成一段 Overlay 文字（供組裝進 system prompt）。
 */
export function assembleOverlayText(
  mode: string,
  structuredJson: string | null | undefined,
  freeText: string
): string {
  const free = (freeText ?? "").trim();
  let structLines: string[] = [];
  try {
    if (structuredJson) {
      const o = JSON.parse(structuredJson) as OverlayStruct;
      if (mode === "boss") structLines = bossStructToLines(o as BossOverlayStruct);
      else if (mode === "buyer") structLines = buyerStructToLines(o as BuyerOverlayStruct);
      else if (mode === "creative") structLines = creativeStructToLines(o as CreativeOverlayStruct);
    }
  } catch {
    // 忽略 JSON 解析錯誤，僅用自由文字
  }
  const parts = [...structLines, free].filter(Boolean);
  return parts.join("\n\n");
}
