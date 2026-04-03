/**
 * 從審判官 AI 回覆文字中解析結構化 JSON 區塊，供前端裁決工作台優先使用。
 * 與 gemini 同一套 extract（extractJsonFromText）+ schema（StructuredJudgmentSchema）。
 */
import type { StructuredJudgment, StructuredJudgmentProblemType, StructuredJudgmentConfidence } from "@shared/schema";
import { extractJsonFromText } from "./lib/extract-json";
import { StructuredJudgmentSchema } from "./gemini-response-schema";

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
 * 從 AI 回覆中擷取 JSON（與 gemini 共用 extractJsonFromText）並解析為 StructuredJudgment。
 * 至少要有 summary 或 nextAction 其一才視為有效；產出經 StructuredJudgmentSchema 驗證。
 * impactAmount：優先使用 JSON 內 impactAmount，否則從 evidence / summary 推導。
 */
export function parseStructuredJudgmentFromResponse(text: string): StructuredJudgment | null {
  const parsed = extractJsonFromText(text);
  if (parsed === null || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;

  const summary = typeof record.summary === "string" ? record.summary.trim() : undefined;
  const nextAction = typeof record.nextAction === "string" ? record.nextAction.trim() : undefined;
  if (!summary && !nextAction) return null;

  const problemType = normalizeProblemType(record.problemType);
  const confidence = normalizeConfidence(record.confidence);
  const recommendTask =
    typeof record.recommendTask === "boolean"
      ? record.recommendTask
      : typeof record.recommendTask === "string"
        ? /是|true|建議|可產/i.test(record.recommendTask) && !/否|false|不建議/i.test(record.recommendTask)
        : undefined;
  const reasons = typeof record.reasons === "string" ? record.reasons.trim() : undefined;
  const suggestions = typeof record.suggestions === "string" ? record.suggestions.trim() : undefined;
  const evidence = typeof record.evidence === "string" ? record.evidence.trim() : undefined;
  const impactAmountRaw = typeof record.impactAmount === "string" ? record.impactAmount.trim() : undefined;
  const impactAmount =
    impactAmountRaw && impactAmountRaw.length > 0
      ? impactAmountRaw
      : extractAmountFromText([evidence, summary, nextAction].filter(Boolean).join(" "));

  const scoreRaw = record.score;
  const score =
    typeof scoreRaw === "number" && Number.isFinite(scoreRaw)
      ? Math.min(100, Math.max(0, Math.round(scoreRaw)))
      : typeof scoreRaw === "string"
        ? (() => {
            const n = parseFloat(scoreRaw);
            return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : undefined;
          })()
        : undefined;

  const blockingReasons = Array.isArray(record.blockingReasons)
    ? (record.blockingReasons as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : undefined;
  const pendingItems = Array.isArray(record.pendingItems)
    ? (record.pendingItems as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : undefined;

  const candidate = {
    ...(summary && { summary }),
    ...(nextAction && { nextAction }),
    ...(problemType && { problemType }),
    ...(recommendTask !== undefined && { recommendTask }),
    ...(confidence && { confidence }),
    ...(reasons && { reasons }),
    ...(suggestions && { suggestions }),
    ...(evidence && { evidence }),
    ...(impactAmount && { impactAmount }),
    ...(score !== undefined && { score }),
    ...(blockingReasons?.length && { blockingReasons }),
    ...(pendingItems?.length && { pendingItems }),
  };
  const validated = StructuredJudgmentSchema.safeParse(candidate);
  if (!validated.success) return null;
  return validated.data as StructuredJudgment;
}
