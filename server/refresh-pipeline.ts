/**
 * 階段二：Refresh 候選 batch 建置管線。僅負責產出 candidate batch，不寫入 storage。
 * 由 refresh-job-runner 在成功後呼叫 saveBatch，保證原子切換。
 */
import type { RefreshJob, AnalysisBatch, SyncedAccount, CampaignMetrics, GA4FunnelMetrics } from "@shared/schema";
import type { RefreshJobErrorStage } from "@shared/schema";
import { resolveDateRange, BATCH_COMPUTATION_VERSION } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { clearCampaignParseCache } from "@shared/tag-aggregation-engine";
import { fetchMetaCampaignData, fetchMultiWindowMetrics } from "./meta-data-fetcher";
import { fetchGA4FunnelData, fetchGA4PageData } from "./ga4-data-fetcher";
import { detectCampaignAnomalies, detectGA4Anomalies, identifyRiskyCampaigns, calculateAccountHealth } from "./analysis-engine";
import {
  computeAccountAvg,
  calculateCampaignTriScore,
  classifyRiskLevel,
  evaluateStopLoss,
  classifyOpportunities,
  calculateAccountTriScore,
  calculatePageTriScore,
  buildCampaignScoringResult,
  buildPageScoringResult,
  buildAccountScoringResult,
  buildBoardSet,
} from "./scoring-engine";
import { generateCrossAccountSummary } from "./ai-summary-pipeline";
import { mapWithConcurrency, DEFAULT_REFRESH_FETCH_CONCURRENCY } from "./lib/concurrency";
import { withExponentialBackoff } from "./lib/retry";
import { yieldToEventLoop } from "./lib/event-loop-yield";

const REFRESH_FETCH_CONCURRENCY = Math.max(1, parseInt(process.env.REFRESH_FETCH_CONCURRENCY || String(DEFAULT_REFRESH_FETCH_CONCURRENCY), 10) || DEFAULT_REFRESH_FETCH_CONCURRENCY);

function fail(stage: RefreshJobErrorStage, message: string): never {
  const e = new Error(message) as Error & { stage: RefreshJobErrorStage };
  e.stage = stage;
  throw e;
}

export type PipelineProgress = (step: number, message: string) => void;

/**
 * 建置 refresh 候選 batch，不寫入 storage。失敗時拋出 { stage, message }。
 */
export async function buildRefreshCandidateBatch(
  job: RefreshJob,
  onProgress?: PipelineProgress
): Promise<AnalysisBatch> {
  const userId = job.userId;
  const datePreset = job.datePreset;
  const customStart = job.customStart;
  const customEnd = job.customEnd;
  const selectedAccountIds = job.selectedAccountIds || [];
  const selectedPropertyIds = job.selectedPropertyIds || [];

  const settings = storage.getSettings(userId);
  const dateRange = resolveDateRange(datePreset, customStart, customEnd);

  const progress = (step: number, msg: string) => {
    storage.setRefreshStatus(userId, { currentStep: msg, progress: step });
    onProgress?.(step, msg);
  };

  const isFixtureMode = process.env.REFRESH_TEST_MODE === "fixture" || process.env.REFRESH_TEST_MODE === "mock";
  // 驗收用：可控失敗注入（支援 FORCE_REFRESH_FAILURE_STAGE 與 PHASE2_INJECT_FAILURE）
  const injectStage = (process.env.FORCE_REFRESH_FAILURE_STAGE || process.env.PHASE2_INJECT_FAILURE) as RefreshJobErrorStage | undefined;
  if (injectStage) {
    fail(injectStage, "驗收用注入失敗（FORCE_REFRESH_FAILURE_STAGE/PHASE2_INJECT_FAILURE）");
  }

  try {
    clearCampaignParseCache();
    progress(10, "同步帳號...");
    let syncedAccounts = storage.getSyncedAccounts(userId);

    if (!isFixtureMode && selectedAccountIds.length > 0) {
      const syncedMetaIds = new Set(syncedAccounts.filter((a: SyncedAccount) => a.platform === "meta").map(a => a.accountId));
      const missingIds = selectedAccountIds.filter((id: string) => !syncedMetaIds.has(id));
      if (missingIds.length > 0 && settings.fbAccessToken?.trim()) {
        try {
          const acctRes = await withExponentialBackoff(
            () =>
              fetch(
                `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(settings.fbAccessToken.trim())}`
              ),
            { maxAttempts: 3 }
          );
          const acctData = await acctRes.json();
          if (acctRes.ok && acctData.data) {
            const missingSet = new Set(missingIds);
            const now = new Date().toISOString();
            const newAccounts: SyncedAccount[] = (acctData.data as any[])
              .filter((a: any) => missingSet.has(a.account_id || a.id?.replace("act_", "") || ""))
              .map((a: any) => ({
                id: `meta-${a.account_id || a.id?.replace("act_", "")}`,
                userId,
                platform: "meta" as const,
                accountId: a.account_id || a.id?.replace("act_", "") || "",
                accountName: a.name || "未命名帳號",
                status: a.account_status === 1 ? ("active" as const) : ("disconnected" as const),
                lastSyncedAt: now,
                isDefault: false,
                currency: a.currency || "USD",
                timezoneName: a.timezone_name || "",
                metaAccountStatus: a.account_status,
              }));
            if (newAccounts.length > 0) {
              syncedAccounts = [...syncedAccounts, ...newAccounts];
              storage.saveSyncedAccounts(userId, syncedAccounts);
            }
          }
        } catch (e) {
          console.warn("[Refresh] Auto-sync Meta accounts failed:", e);
        }
      }
    }

    let metaAccounts = syncedAccounts.filter((a: SyncedAccount) => a.platform === "meta" && a.status === "active");
    let ga4Accounts = syncedAccounts.filter((a: SyncedAccount) => a.platform === "ga4" && a.status === "active");
    if (selectedAccountIds.length > 0) metaAccounts = metaAccounts.filter((a: SyncedAccount) => selectedAccountIds.includes(a.accountId));
    if (selectedPropertyIds.length > 0) ga4Accounts = ga4Accounts.filter((a: SyncedAccount) => selectedPropertyIds.includes(a.accountId));

    progress(20, "擷取 Meta 與 GA4 數據...");
    let metaResults: CampaignMetrics[];
    let ga4Results: GA4FunnelMetrics[];
    if (isFixtureMode) {
      metaResults = [];
      ga4Results = [];
    } else {
      try {
        const [meta, ga4] = await Promise.all([
          !settings.fbAccessToken?.trim() || metaAccounts.length === 0
            ? Promise.resolve([])
            : mapWithConcurrency(metaAccounts, REFRESH_FETCH_CONCURRENCY, (account: SyncedAccount) =>
                withExponentialBackoff(() =>
                  fetchMetaCampaignData(settings.fbAccessToken!, account.accountId, account.accountName, datePreset, customStart, customEnd),
                  { maxAttempts: 3 }
                )
              ).then((r) => r.flat()),
          !process.env.GOOGLE_SERVICE_ACCOUNT_KEY || ga4Accounts.length === 0
            ? Promise.resolve([])
            : mapWithConcurrency(ga4Accounts, REFRESH_FETCH_CONCURRENCY, (account: SyncedAccount) =>
                withExponentialBackoff(() =>
                  fetchGA4FunnelData(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, account.accountId, account.accountName, datePreset, customStart, customEnd),
                  { maxAttempts: 3 }
                )
              ).then((r) => r.filter((m): m is GA4FunnelMetrics => m !== null)),
        ]);
        metaResults = meta;
        ga4Results = ga4;
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        if (msg.includes("GA4") || msg.includes("google")) fail("ga4_fetch", msg);
        fail("meta_fetch", msg);
      }
    }

    let allCampaignMetrics = metaResults;
    const allGA4Metrics = ga4Results;

    progress(40, "擷取多時間窗口數據...");
    const accountGroupsForMW = new Map<string, CampaignMetrics[]>();
    for (const c of allCampaignMetrics) {
      if (!accountGroupsForMW.has(c.accountId)) accountGroupsForMW.set(c.accountId, []);
      accountGroupsForMW.get(c.accountId)!.push(c);
    }
    if (!isFixtureMode && settings.fbAccessToken?.trim()) {
      const entries = Array.from(accountGroupsForMW.entries());
      const mwResults = await mapWithConcurrency(entries, REFRESH_FETCH_CONCURRENCY, ([actId, camps]) =>
        withExponentialBackoff(() => fetchMultiWindowMetrics(settings.fbAccessToken!, actId, camps), { maxAttempts: 3 })
      );
      for (const mwMap of mwResults) {
        for (const c of allCampaignMetrics) {
          const mw = mwMap.get(c.campaignId);
          if (mw) c.multiWindow = mw;
        }
      }
    }

    progress(50, "擷取 GA4 頁面數據...");
    let allGA4PageMetrics: any[] = [];
    if (!isFixtureMode && process.env.GOOGLE_SERVICE_ACCOUNT_KEY && ga4Accounts.length > 0) {
      const pageResults = await mapWithConcurrency(ga4Accounts, REFRESH_FETCH_CONCURRENCY, (account: SyncedAccount) =>
        withExponentialBackoff(() =>
          fetchGA4PageData(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, account.accountId, datePreset, customStart, customEnd),
          { maxAttempts: 3 }
        )
      );
      allGA4PageMetrics = pageResults.flat();
    }

    progress(60, "計算三維評分與風險分析...");
    try {
      const globalAvg = computeAccountAvg(allCampaignMetrics);
      let loopIdx = 0;
      for (const c of allCampaignMetrics) {
        if (++loopIdx % 50 === 0) await yieldToEventLoop();
        const acctCampaigns = accountGroupsForMW.get(c.accountId) || allCampaignMetrics;
        const acctAvg = computeAccountAvg(acctCampaigns);
        c.triScore = calculateCampaignTriScore(c, acctAvg);
        c.riskLevel = classifyRiskLevel(c.triScore, c, acctAvg);
        c.stopLoss = evaluateStopLoss(c, acctAvg, acctCampaigns);
        c.scoring = buildCampaignScoringResult(c, acctAvg, c.triScore, c.riskLevel, c.stopLoss);
      }
    } catch (e) {
      fail("aggregation", (e as Error)?.message ?? String(e));
    }

    progress(65, "執行異常檢測與分析...");
    const allAnomalies: any[] = [];
    const accountHealthScores: any[] = [];
    const accountGroups = new Map<string, CampaignMetrics[]>();
    for (const c of allCampaignMetrics) {
      if (!accountGroups.has(c.accountId)) accountGroups.set(c.accountId, []);
      accountGroups.get(c.accountId)!.push(c);
    }
    let accountGroupIdx = 0;
    for (const [accountId, campaigns] of accountGroups) {
      if (++accountGroupIdx % 30 === 0) await yieldToEventLoop();
      const accountName = campaigns[0]?.accountName || accountId;
      const anomalies = detectCampaignAnomalies(campaigns, accountName);
      allAnomalies.push(...anomalies);
      const health = calculateAccountHealth(accountId, accountName, "meta", campaigns, anomalies, allCampaignMetrics, null);
      const acctAvg = computeAccountAvg(campaigns);
      const acctTriScore = calculateAccountTriScore(campaigns, anomalies, acctAvg);
      health.triScore = acctTriScore;
      health.riskLevel = acctTriScore.health < 30 && acctTriScore.urgency >= 50 ? "danger" : acctTriScore.health < 50 ? "warning" : acctTriScore.scalePotential >= 60 ? "potential" : "stable";
      health.priorityScore = acctTriScore.urgency;
      health.healthStatus = health.riskLevel === "danger" ? "danger" : health.riskLevel === "warning" ? "warning" : "healthy";
      accountHealthScores.push(health);
    }
    for (const ga4 of allGA4Metrics) {
      const ga4Anomalies = detectGA4Anomalies(ga4, ga4.propertyName);
      allAnomalies.push(...ga4Anomalies);
      if (!accountHealthScores.some((h: any) => h.accountId === ga4.propertyId)) {
        accountHealthScores.push(
          calculateAccountHealth(ga4.propertyId, ga4.propertyName, "ga4", [], ga4Anomalies, allCampaignMetrics, ga4)
        );
      }
    }

    progress(70, "識別機會與風險...");
    const globalAvg = computeAccountAvg(allCampaignMetrics);
    const riskyCampaigns = identifyRiskyCampaigns(allCampaignMetrics);
    const scaleOpportunities = riskyCampaigns.filter((r: any) => r.riskType === "low_spend_high_potential");
    const realRisks = riskyCampaigns.filter((r: any) => r.riskType !== "low_spend_high_potential");
    const riskyCampaignIds = new Set(realRisks.map((r: any) => r.campaignId));
    const opportunities = classifyOpportunities(allCampaignMetrics, globalAvg, riskyCampaignIds);

    progress(72, "計算 V2 評分與戰情板...");
    if (allGA4PageMetrics.length > 0) {
      const siteAvg = {
        conversionRate: allGA4PageMetrics.reduce((s: number, p: any) => s + p.conversionRate, 0) / allGA4PageMetrics.length,
        bounceRate: allGA4PageMetrics.reduce((s: number, p: any) => s + p.bounceRate, 0) / allGA4PageMetrics.length,
        avgEngagementTime: allGA4PageMetrics.reduce((s: number, p: any) => s + p.avgEngagementTime, 0) / allGA4PageMetrics.length,
      };
      for (const page of allGA4PageMetrics) {
        if (page.triScore && page.riskLevel) {
          page.scoring = buildPageScoringResult(page, siteAvg, page.triScore, page.riskLevel);
        }
      }
    }
    for (const acctHealth of accountHealthScores) {
      const acctCampaigns = accountGroups.get(acctHealth.accountId) || [];
      const acctAnomalies = allAnomalies.filter((a: any) => a.accountId === acctHealth.accountId);
      const acctAvg = computeAccountAvg(acctCampaigns);
      const acctTriScore = acctHealth.triScore || { health: 50, urgency: 0, scalePotential: 30 };
      const acctRiskLevel = acctHealth.riskLevel || "stable";
      acctHealth.scoring = buildAccountScoringResult(acctTriScore, acctRiskLevel, acctCampaigns, acctAnomalies, acctAvg);
    }
    const boards = buildBoardSet(allCampaignMetrics, allGA4PageMetrics, accountHealthScores);

    progress(80, "產生 AI 策略摘要...");
    let summary: any;
    try {
      summary = await generateCrossAccountSummary(settings.aiApiKey || "", {
        accounts: accountHealthScores,
        anomalies: allAnomalies,
        riskyCampaigns: realRisks,
        scaleOpportunities,
        campaigns: allCampaignMetrics,
        ga4Data: allGA4Metrics,
        dateLabel: dateRange.label,
        opportunities,
        boards,
      });
    } catch (e) {
      fail("aggregation", (e as Error)?.message ?? String(e));
    }

    const batch: AnalysisBatch = {
      batchId: randomUUID(),
      userId,
      selectedAccountIds,
      selectedPropertyIds,
      dateRange,
      campaignMetrics: allCampaignMetrics,
      ga4Metrics: allGA4Metrics,
      ga4PageMetrics: allGA4PageMetrics,
      anomalies: allAnomalies,
      accountRankings: accountHealthScores,
      riskyCampaigns: realRisks,
      scaleOpportunities,
      opportunities,
      summary,
      boards,
      generatedAt: new Date().toISOString(),
    };

    progress(90, "預計算 action-center 與 scorecard...");
    try {
      const { buildActionCenterPayload } = await import("./build-action-center-payload");
      const { buildScorecardPayload } = await import("./build-scorecard-payload");
      const nextActionCenter = await buildActionCenterPayload(batch, { useOverrides: true });
      const nextScorecard = await buildScorecardPayload(batch);
      batch.precomputedActionCenter = nextActionCenter;
      batch.precomputedScorecard = nextScorecard;
      batch.precomputeCompletedAt = new Date().toISOString();
      batch.computationVersion = BATCH_COMPUTATION_VERSION;
    } catch (e) {
      fail("precompute", (e as Error)?.message ?? String(e));
    }

    return batch;
  } catch (err: any) {
    if (err?.stage) throw err;
    throw Object.assign(new Error(err?.message ?? String(err)), { stage: "unknown" as RefreshJobErrorStage });
  }
}
