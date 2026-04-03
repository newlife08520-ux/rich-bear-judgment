import type { StructuredJudgment } from "@shared/schema";
import type { ChatMessage } from "@shared/schema";
import type { JudgmentContext, ParsedJudgment, TaskCreateFromJudgmentPayload } from "./judgment-types";
import { parseJudgmentContent } from "./judgment-parsers";

/** 結構化 confidence（高/中/低）→ 前端用的 high/medium/low */
export function structuredConfidenceToKey(
  c: StructuredJudgment["confidence"]
): ParsedJudgment["confidence"] {
  if (!c) return null;
  if (c === "高") return "high";
  if (c === "中") return "medium";
  if (c === "低") return "low";
  return null;
}

/** 後端結構化欄位 → 前端裁決骨架（供摘要卡與一鍵轉任務使用）。passed 由系統依 score >= threshold 計算，不從模型來。 */
export function mapStructuredToParsed(s: StructuredJudgment): ParsedJudgment {
  return {
    verdict: s.summary ?? "",
    actionFirst: s.nextAction ?? "",
    problemType: s.problemType ?? null,
    suggestTask: s.recommendTask ?? null,
    confidence: structuredConfidenceToKey(s.confidence),
    reason: s.reasons ?? "",
    suggestions: s.suggestions ?? "",
    evidence: s.evidence ?? "",
    impactAmount: s.impactAmount ?? "",
    score: s.score,
    blockingReasons: s.blockingReasons,
    pendingItems: s.pendingItems,
  };
}

/** 單則裁決的標題與內文（用於固定結構裁決報告） */
export function getParsedForMessage(message: ChatMessage): ParsedJudgment {
  return message.structuredJudgment != null
    ? mapStructuredToParsed(message.structuredJudgment)
    : parseJudgmentContent(message.content);
}

/** 問題類型 → 任務類型（對應 workbench taskType） */
const PROBLEM_TYPE_TO_TASK_TYPE: Record<NonNullable<ParsedJudgment["problemType"]>, string> = {
  創意: "creative",
  商品頁: "landing_page",
  投放: "fb_ads",
  漏斗: "ga4_funnel",
};

/** 轉任務時收斂欄位：一句明確任務、執行動作、簡短原因，避免過長造成列表難讀 */
export function buildTaskPayloadFromParsed(
  parsed: ParsedJudgment,
  ctx: JudgmentContext
): TaskCreateFromJudgmentPayload {
  const title =
    (parsed.verdict || "審判建議").replace(/\s+/g, " ").trim().slice(0, 60) || "審判建議";
  const actionLine = parsed.actionFirst.split(/\n/)[0]?.trim() || parsed.actionFirst.trim();
  const action = actionLine.slice(0, 150) || "請見完整內容";
  const reason = (parsed.reason || parsed.suggestions).replace(/\s+/g, " ").trim().slice(0, 300) || "";
  return {
    title,
    action,
    reason,
    taskType: parsed.problemType ? PROBLEM_TYPE_TO_TASK_TYPE[parsed.problemType] : null,
    priority: parsed.confidence ?? null,
    taskSource: "審判官",
    productName: ctx.productName ?? null,
    creativeId: ctx.creativeId ?? null,
    impactAmount:
      parsed.impactAmount?.trim() ? parsed.impactAmount.trim() : (ctx.impactAmount ?? null),
    reviewSessionId: ctx.sessionId ?? null,
  };
}
