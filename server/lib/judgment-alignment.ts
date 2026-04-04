/**
 * Phase 5：系統 action 為權威，AI 不可輸出與之矛盾的預算建議。
 * 用於對齊 nextAction / 文案，避免 AI 與規則引擎腦裂。
 */

const DECREASE_PATTERNS = /降|減|停|止|止血|hold|stop|decrease|縮/i;
const INCREASE_PATTERNS = /加碼|擴|增|提高|scale|increase|拉高/i;

/** 移除否定語境後再做方向偵測 */
function removeNegationContext(text: string): string {
  return text
    .replace(/不要\S{1,4}/g, "")
    .replace(/不建議\S{1,6}/g, "")
    .replace(/勿\S{1,3}/g, "")
    .replace(/避免\S{1,4}/g, "")
    .replace(/不必\S{1,3}/g, "")
    .replace(/誤\S{1,2}/g, "")
    .replace(/don'?t\s+\w+/gi, "");
}

function systemSuggestsDecrease(action: string, pct?: string | number): boolean {
  const s = removeNegationContext((action ?? "").trim());
  if (DECREASE_PATTERNS.test(s)) return true;
  if (typeof pct === "string" && /降|減|關閉/.test(removeNegationContext(pct))) return true;
  if (pct === "關閉") return true;
  return false;
}

function systemSuggestsIncrease(action: string): boolean {
  const s = removeNegationContext((action ?? "").trim());
  return INCREASE_PATTERNS.test(s);
}

function systemSuggestsHold(action: string): boolean {
  const s = (action ?? "").trim();
  return /維持|hold|觀察|不變/.test(s);
}

/** 檢測 AI 文案是否在建議加碼/擴量 */
function aiSuggestsIncrease(aiText: string): boolean {
  const cleaned = removeNegationContext(aiText ?? "");
  return INCREASE_PATTERNS.test(cleaned);
}

/** 檢測 AI 文案是否在建議降/停 */
function aiSuggestsDecrease(aiText: string): boolean {
  const cleaned = removeNegationContext(aiText ?? "");
  return DECREASE_PATTERNS.test(cleaned);
}

export interface AlignmentResult {
  /** 對齊後的 nextAction 文案（矛盾時改為系統權威說法） */
  alignedNextAction: string;
  /** 是否發生矛盾 */
  violated: boolean;
  /** 若發生矛盾，記錄用 */
  violationReason?: string;
}

/**
 * 以系統建議動作為權威，若 AI 輸出與之矛盾則回傳對齊後文案，否則回傳原 AI 文案。
 * 不修改其他欄位，呼叫端應以 alignedNextAction 覆寫對外輸出的 nextAction。
 */
export function validateJudgmentAgainstSystemAction(
  systemAction: string,
  systemPct: string | number | undefined,
  aiNextAction: string | undefined
): AlignmentResult {
  const ai = (aiNextAction ?? "").trim();
  if (!ai) return { alignedNextAction: ai, violated: false };

  const sysDecrease = systemSuggestsDecrease(systemAction, systemPct);
  const sysIncrease = systemSuggestsIncrease(systemAction);
  const sysHold = systemSuggestsHold(systemAction);

  if (sysDecrease && aiSuggestsIncrease(ai)) {
    const fallback = systemPct != null && systemPct !== "關閉"
      ? `依系統建議降 ${systemPct}%，請勿與規則引擎相反`
      : "依系統建議降/停，請勿與規則引擎相反";
    return { alignedNextAction: fallback, violated: true, violationReason: "system_decrease_ai_increase" };
  }
  if (sysHold && (aiSuggestsIncrease(ai) || aiSuggestsDecrease(ai))) {
    return { alignedNextAction: "依系統建議維持，請勿與規則引擎相反", violated: true, violationReason: "system_hold_ai_change" };
  }
  if (sysIncrease && aiSuggestsDecrease(ai)) {
    return { alignedNextAction: "依系統建議加碼/擴量，請勿與規則引擎相反", violated: true, violationReason: "system_increase_ai_decrease" };
  }

  return { alignedNextAction: ai, violated: false };
}
