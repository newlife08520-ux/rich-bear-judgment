/**
 * 首頁決策中心：金額、時間、證據標籤等純展示用 formatter。
 */

export function formatCurrency(value: number): string {
  return `NT$ ${value.toLocaleString()}`;
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return "尚未更新";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/** 證據層級標籤（Phase 2A Guardrail 3） */
export const EVIDENCE_LABELS: Record<string, string> = {
  ads_only: "廣告層推測",
  ga_verified: "已有 GA 證據",
  rules_missing: "規則缺失",
  insufficient_sample: "樣本不足",
  no_delivery: "尚未投遞",
};

export function getEvidenceLabel(level: string | undefined): string {
  if (!level) return "";
  return EVIDENCE_LABELS[level] ?? level;
}
