/**
 * 首頁／儀表板：cross-account-summary 與 data-confidence 共用的「資料真相」判定。
 * 避免僅依 batch.summary 而忽略已有 campaignMetrics 的決策訊號。
 */
import type { AnalysisBatch, CrossAccountSummary } from "./schema";
import type { BatchValidity } from "./schema";
import { getBatchValidity } from "./batch-validity";

export type DashboardDataStatus = "no_sync" | "synced_no_data" | "has_data" | "partial_data";

export type HomepageDataTruth = "summary_ok" | "partial_decision" | "no_decision";

export interface HomepageCrossAccountPayload {
  homepageDataTruth: HomepageDataTruth;
  dataStatus: DashboardDataStatus;
  hasSummary: boolean;
  hasDecisionSignals: boolean;
  message: string;
  coverageNote: string | null;
  summary?: CrossAccountSummary;
  batchValidity: BatchValidity;
  batchValidityReason?: string;
}

export function buildHomepageCrossAccountPayload(input: {
  batch: AnalysisBatch | null | undefined;
  hasSyncedAccounts: boolean;
}): HomepageCrossAccountPayload {
  const batch = input.batch ?? null;
  const bv = getBatchValidity(batch);
  const metricsLen = batch?.campaignMetrics?.length ?? 0;
  const hasMetrics = metricsLen > 0;
  const hasSummary = Boolean(batch?.summary);

  const base = {
    batchValidity: bv.validity,
    batchValidityReason: bv.reason,
  };

  if (!batch) {
    return {
      homepageDataTruth: "no_decision",
      dataStatus: input.hasSyncedAccounts ? "synced_no_data" : "no_sync",
      hasSummary: false,
      hasDecisionSignals: false,
      message: input.hasSyncedAccounts
        ? "已同步但尚無分析批次，請執行「更新資料」以產生決策資料。"
        : "請先同步 FB／GA4 帳號並完成資料刷新。",
      coverageNote: null,
      ...base,
    };
  }

  if (hasSummary && hasMetrics) {
    const coverageNote =
      bv.validity !== "valid" ? (bv.reason ?? "覆蓋或結構尚未達完整標準") : null;
    return {
      homepageDataTruth: "summary_ok",
      dataStatus: "has_data",
      hasSummary: true,
      hasDecisionSignals: true,
      message: coverageNote
        ? "摘要與活動資料已取得；部分維度覆蓋仍不足，請一併參考「資料健康」。"
        : "摘要與決策資料已就緒。",
      coverageNote,
      summary: batch.summary!,
      ...base,
    };
  }

  if (hasSummary && !hasMetrics) {
    return {
      homepageDataTruth: "no_decision",
      dataStatus: input.hasSyncedAccounts ? "synced_no_data" : "no_sync",
      hasSummary: true,
      hasDecisionSignals: false,
      message: "已有摘要但無活動明細，請重新整理或檢查帳號／日期範圍。",
      coverageNote: bv.reason ?? null,
      summary: batch.summary,
      ...base,
    };
  }

  if (hasMetrics) {
    return {
      homepageDataTruth: "partial_decision",
      dataStatus: "partial_data",
      hasSummary: false,
      hasDecisionSignals: true,
      message:
        "批次摘要尚未產生，但活動／商品層資料已足以下方「今日決策中心」運作；可先依五區採取行動，並執行刷新以補齊摘要。",
      coverageNote: null,
      ...base,
    };
  }

  return {
    homepageDataTruth: "no_decision",
    dataStatus: input.hasSyncedAccounts ? "synced_no_data" : "no_sync",
    hasSummary: false,
    hasDecisionSignals: false,
    message: input.hasSyncedAccounts
      ? "已同步但目前沒有可讀的行銷活動列，請執行刷新或檢查帳號範圍。"
      : "請先同步帳號。",
    coverageNote: null,
    ...base,
  };
}

/** 併入 data-confidence：不含 summary，避免重複大包。 */
export function homepageTruthFieldsForDataConfidence(
  batch: AnalysisBatch | null | undefined,
  hasSyncedAccounts: boolean,
  campaignMetricsCount: number
) {
  const full = buildHomepageCrossAccountPayload({ batch, hasSyncedAccounts });
  return {
    homepageDataTruth: full.homepageDataTruth,
    dataStatus: full.dataStatus,
    hasSummary: full.hasSummary,
    hasDecisionSignals: full.hasDecisionSignals,
    message: full.message,
    coverageNote: full.coverageNote,
    batchValidity: full.batchValidity,
    batchValidityReason: full.batchValidityReason,
    campaignMetricsCount,
  };
}
