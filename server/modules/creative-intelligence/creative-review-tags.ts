/**
 * 6.1-D：由 structured 欄位與中文敘述做第一版 tag 萃取（非 NLP 深度模型）。
 */
import type { CreativeAssetJudgmentPayload } from "../../gemini-response-schema";

export type PatternTagRow = { tagType: string; tagValue: string; weight?: number };

/** 7.9：成功模式資料庫 — 支援的 tag 族（與 DB tagType 字串一致） */
export const PATTERN_TAXONOMY_FAMILIES = [
  "hook",
  "pain",
  "proof",
  "cta",
  "format",
  "angle",
  "scene",
  "visual_motif",
  "pacing_motif",
  "visual",
  "pacing",
  "brand",
] as const;

const HEURISTICS: Array<{ re: RegExp; tagType: string; tagValue: string; weight?: number }> = [
  { re: /前\s*3\s*秒.*鉤|沒鉤子|缺鉤|hook/i, tagType: "hook", tagValue: "weak_hook", weight: 0.8 },
  { re: /缺證明|沒有證明|無社會證明/i, tagType: "proof", tagValue: "missing_proof", weight: 0.85 },
  { re: /畫面.*記憶|視覺.*記憶|memorable/i, tagType: "visual", tagValue: "memorable_visual", weight: 0.7 },
  { re: /社交尷尬|尷尬場景/i, tagType: "pain", tagValue: "social_embarrassment", weight: 0.75 },
  { re: /痛點|問題場景/i, tagType: "pain", tagValue: "pain_mentioned", weight: 0.5 },
  { re: /直式|橫式|reels|短影音|9:16/i, tagType: "format", tagValue: "short_video_format", weight: 0.4 },
  { re: /切入點|角度|主張/i, tagType: "angle", tagValue: "angle_clear", weight: 0.45 },
  { re: /場景|實拍|生活感|街景|室內景/i, tagType: "scene", tagValue: "lifestyle_scene", weight: 0.42 },
  { re: /行動呼籲|立即下單|點擊購買|按鈕文案/i, tagType: "cta", tagValue: "cta_mentioned", weight: 0.35 },
  { re: /模糊|失焦|噪點|畫質|顆粒/i, tagType: "visual", tagValue: "low_fidelity_visual", weight: 0.55 },
  { re: /字太多|文字牆|資訊過載|塞滿/i, tagType: "format", tagValue: "text_wall", weight: 0.5 },
  { re: /品牌識別|logo|商標/i, tagType: "brand", tagValue: "brand_salience", weight: 0.3 },
  { re: /開場慢|前段拖|冗長/i, tagType: "pacing", tagValue: "slow_open", weight: 0.45 },
  { re: /節奏快|快切|跳接|卡点/i, tagType: "pacing_motif", tagValue: "fast_cut", weight: 0.4 },
  { re: /重複圖樣|圖騰|符號化|強烈色塊|幾何/i, tagType: "visual_motif", tagValue: "bold_graphic_motif", weight: 0.42 },
];

function uniq(rows: PatternTagRow[]): PatternTagRow[] {
  const seen = new Set<string>();
  const out: PatternTagRow[] = [];
  for (const r of rows) {
    const k = `${r.tagType}:${r.tagValue}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function extractPatternTagsFromPayload(payload: CreativeAssetJudgmentPayload): PatternTagRow[] {
  const rows: PatternTagRow[] = [];
  const blob = [
    payload.summary,
    payload.nextAction,
    payload.reasons,
    payload.suggestions,
    payload.evidence,
    payload.oneLineVerdict,
    ...(payload.keyPoints ?? []),
    ...(payload.fullAnalysis ?? []).map((x) => `${x.title} ${x.content}`),
  ]
    .filter(Boolean)
    .join("\n");

  for (const h of HEURISTICS) {
    if (h.re.test(blob)) {
      rows.push({ tagType: h.tagType, tagValue: h.tagValue, weight: h.weight });
    }
  }

  if (payload.problemType === "創意") {
    rows.push({ tagType: "angle", tagValue: "creative_problem", weight: 0.5 });
  }

  return uniq(rows);
}
