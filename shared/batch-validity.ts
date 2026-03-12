/**
 * Phase 2A Guardrail 6：latest valid batch 規則正式定義。
 * 對齊 docs/華麗熊-總監操盤系統-最終整合版.md §36、§40。
 */
import type { AnalysisBatch } from "./schema";
import {
  BATCH_VALIDITY_VALID,
  BATCH_VALIDITY_LEGACY,
  BATCH_VALIDITY_INSUFFICIENT,
  type BatchValidity,
} from "./schema";

export interface BatchValidityResult {
  validity: BatchValidity;
  reason?: string;
}

/**
 * 判定 batch 是否為 latest valid batch。
 * - valid：可進首頁／核心決策區，具備 summary、campaignMetrics 且可判讀。
 * - legacy：有資料但缺新欄位（如 qualityLabel、evidenceLevel），僅供參考或次級區。
 * - insufficient：無 summary 或無 campaignMetrics，不得進核心區。
 */
export function getBatchValidity(batch: AnalysisBatch | null): BatchValidityResult {
  if (!batch) {
    return { validity: BATCH_VALIDITY_INSUFFICIENT, reason: "無 batch" };
  }
  if (!batch.summary) {
    return { validity: BATCH_VALIDITY_INSUFFICIENT, reason: "缺少 summary" };
  }
  if (!Array.isArray(batch.campaignMetrics) || batch.campaignMetrics.length === 0) {
    return { validity: BATCH_VALIDITY_INSUFFICIENT, reason: "無 campaign 資料" };
  }
  // 具備基本結構即視為 valid；若日後要區分 legacy（缺 qualityLabel 等），可在此加條件
  const hasCoreFields =
    batch.summary &&
    typeof batch.summary.topPriorityAccounts === "object" &&
    Array.isArray(batch.campaignMetrics);
  if (!hasCoreFields) {
    return { validity: BATCH_VALIDITY_LEGACY, reason: "結構不完整" };
  }
  return { validity: BATCH_VALIDITY_VALID };
}
