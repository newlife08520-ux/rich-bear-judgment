/**
 * 從審判官 AI 回覆文字中解析結構化 JSON 區塊，供前端裁決工作台優先使用。
 */
import type { StructuredJudgment, StructuredJudgmentProblemType, StructuredJudgmentConfidence } from "@shared/schema";

const JSON_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/;

function normalizeProblemType(v: unknown): StructuredJudgmentProblemType | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (["創意", "商品頁", "投放", "漏斗"].includes(s)) return s as StructuredJudgmentProblemType;
  if (/創意|素材|影片|圖片/i.test(s)) return "創意";
  if (/商品頁|銷售頁|落地頁/i.test(s)) return "商品頁";
  if (/投放|廣告|文案/i.test(s)) return "投放";
  if (/漏斗|ga4|轉換/i.test(s)) return "漏斗";
  return undefined;
}

function normalizeConfidence(v: unknown): StructuredJudgmentConfidence | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (["高", "中", "低"].includes(s)) return s as StructuredJudgmentConfidence;
  if (/高|high/i.test(s)) return "高";
  if (/中|medium/i.test(s)) return "中";
  if (/低|low/i.test(s)) return "低";
  return undefined;
}

/**
 * 從文字中推導影響金額（最低限度）：優先匹配「約 N 萬」「N 萬」「NT$...」「影響...萬」等。
 * 用於 impactAmount 自動帶入，規則見專案文件。
 */
function extractAmountFromText(t: string): string | undefined {
  if (!t || typeof t !== "string") return undefined;
  const s = t.trim();
  const aboutWan = s.match(/(?:約|大約|估計)\s*(\d+(?:\.\d+)?)\s*萬/);
  if (aboutWan) return `約 ${aboutWan[1]} 萬`;
  const wan = s.match(/(\d+(?:\.\d+)?)\s*萬/);
  if (wan) return `${wan[1]} 萬`;
  const nt = s.match(/NT\s*\$?\s*[\d,]+(?:\s*元)?/);
  if (nt) return nt[0].trim();
  const yuan = s.match(/[\d,]+(?:\s*元)/);
  if (yuan) return yuan[0].trim();
  const impact = s.match(/影響[^\d]*(\d+(?:\.\d+)?)\s*萬/);
  if (impact) return `約 ${impact[1]} 萬`;
  return undefined;
}

/**
 * 從 AI 回覆中擷取 ```json ... ``` 並解析為 StructuredJudgment。
 * 至少要有 summary 或 nextAction 其一才視為有效。
 * impactAmount：優先使用 JSON 內 impactAmount，否則從 evidence / summary 推導。
 */
export function parseStructuredJudgmentFromResponse(text: string): StructuredJudgment | null {
  if (!text || typeof text !== "string") return null;
  const match = text.match(JSON_BLOCK_RE);
  const jsonStr = match ? match[1].trim() : text.trim();
  if (!jsonStr) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : undefined;
  const nextAction = typeof parsed.nextAction === "string" ? parsed.nextAction.trim() : undefined;
  if (!summary && !nextAction) return null;

  const problemType = normalizeProblemType(parsed.problemType);
  const confidence = normalizeConfidence(parsed.confidence);
  const recommendTask =
    typeof parsed.recommendTask === "boolean"
      ? parsed.recommendTask
      : typeof parsed.recommendTask === "string"
        ? /是|true|建議|可產/i.test(parsed.recommendTask) && !/否|false|不建議/i.test(parsed.recommendTask)
        : undefined;
  const reasons = typeof parsed.reasons === "string" ? parsed.reasons.trim() : undefined;
  const suggestions = typeof parsed.suggestions === "string" ? parsed.suggestions.trim() : undefined;
  const evidence = typeof parsed.evidence === "string" ? parsed.evidence.trim() : undefined;
  const impactAmountRaw = typeof parsed.impactAmount === "string" ? parsed.impactAmount.trim() : undefined;
  const impactAmount =
    impactAmountRaw && impactAmountRaw.length > 0
      ? impactAmountRaw
      : extractAmountFromText([evidence, summary, nextAction].filter(Boolean).join(" "));

  return {
    ...(summary && { summary }),
    ...(nextAction && { nextAction }),
    ...(problemType && { problemType }),
    ...(recommendTask !== undefined && { recommendTask }),
    ...(confidence && { confidence }),
    ...(reasons && { reasons }),
    ...(suggestions && { suggestions }),
    ...(evidence && { evidence }),
    ...(impactAmount && { impactAmount }),
  };
}
