/**
 * Dashboard truth／首頁摘要 API（Batch 12.2 routes-split-a；Batch 15.9 再抽出 verdict／priorities／risk／overview）。
 */
import type { Express, Request, RequestHandler } from "express";
import { storage } from "../storage";
import type { AnalysisBatch, SyncedAccount } from "@shared/schema";
import { buildHomepageCrossAccountPayload } from "@shared/homepage-data-truth";
import {
  buildTodayVerdict,
  buildTodayPriorities,
  buildRealHighRiskItems,
  buildRealGA4HighRiskItems,
  buildBusinessOverview,
} from "../real-data-transformers";

export function getBatchFromRequest(req: Request): AnalysisBatch | null {
  const userId = req.session.userId!;
  const scopeKey = (req.query.scope as string) || undefined;
  return storage.getLatestBatch(userId, scopeKey);
}

export function registerDashboardTruthRoutes(app: Express, requireAuth: RequestHandler): void {
  app.get("/api/dashboard/cross-account-summary", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const syncedAccounts = storage.getSyncedAccounts(userId);
    const batch = getBatchFromRequest(req);
    const metaCount = syncedAccounts.filter((a: SyncedAccount) => a.platform === "meta").length;
    const ga4Count = syncedAccounts.filter((a: SyncedAccount) => a.platform === "ga4").length;
    const hasSynced = metaCount > 0 || ga4Count > 0;
    const payload = buildHomepageCrossAccountPayload({
      batch: batch ?? null,
      hasSyncedAccounts: hasSynced,
    });
    res.json({
      ...payload,
      hasSummary: payload.hasSummary,
    });
  });

  app.get("/api/dashboard/today-verdict", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch) return res.json(null);
    res.json(buildTodayVerdict(batch));
  });

  app.get("/api/dashboard/today-priorities", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch) return res.json([]);
    res.json(buildTodayPriorities(batch));
  });

  app.get("/api/dashboard/high-risk", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch) return res.json([]);
    const fbRisks = batch.campaignMetrics.length > 0 ? buildRealHighRiskItems(batch.campaignMetrics) : [];
    const ga4Risks = batch.ga4Metrics.length > 0 ? buildRealGA4HighRiskItems(batch.ga4Metrics) : [];
    res.json([...fbRisks, ...ga4Risks]);
  });

  app.get("/api/dashboard/business-overview", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch) return res.json(null);
    res.json(buildBusinessOverview(batch));
  });
}
