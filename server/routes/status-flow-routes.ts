import type { Express, Request, Response, NextFunction } from "express";
import {
  buildScopeKey,
  type AnalysisBatch,
  type DataFlowStatus,
  type DataSourceStatus,
} from "@shared/schema";
import { storage } from "../storage";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;
type GetBatchFromRequest = (req: Request) => AnalysisBatch | null;

export function registerStatusFlowRoutes(
  app: Express,
  requireAuth: RequireAuth,
  getBatchFromRequest: GetBatchFromRequest
): void {
  app.get("/api/status/data-sources", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const syncedAccounts = storage.getSyncedAccounts(userId);
    const batch = getBatchFromRequest(req);
    const refreshStatus = storage.getRefreshStatus(userId);

    const metaAccounts = syncedAccounts.filter((a) => a.platform === "meta");
    const ga4Accounts = syncedAccounts.filter((a) => a.platform === "ga4");

    const metaSelected = batch?.selectedAccountIds || [];
    const ga4Selected = batch?.selectedPropertyIds || [];

    const metaHasToken = !!settings.fbAccessToken?.trim();
    const ga4HasProperty = !!settings.ga4PropertyId?.trim();

    const metaLastSync =
      metaAccounts.length > 0
        ? metaAccounts.reduce((latest, a) => (a.lastSyncedAt > latest ? a.lastSyncedAt : latest), "")
        : null;
    const ga4LastSync =
      ga4Accounts.length > 0
        ? ga4Accounts.reduce((latest, a) => (a.lastSyncedAt > latest ? a.lastSyncedAt : latest), "")
        : null;

    const metaStatus: DataSourceStatus = {
      platform: "meta",
      connectionStatus: metaHasToken ? "connected" : "not_configured",
      syncStatus: metaAccounts.length > 0 ? "synced" : metaHasToken ? "never_synced" : "never_synced",
      selectionStatus: metaSelected.length > 0 ? "selected" : "none_selected",
      analysisStatus: batch && batch.campaignMetrics.length > 0 ? "analyzed" : "never_analyzed",
      lastSyncedAt: metaLastSync || null,
      lastAnalyzedAt: refreshStatus.lastAnalysisAt || null,
      accountCount: metaAccounts.length,
      selectedCount: metaSelected.length,
      message: !metaHasToken
        ? "請先設定 Facebook Access Token"
        : metaAccounts.length === 0
          ? "請先同步 Token 或選擇帳號"
          : metaSelected.length === 0
            ? `請選擇要分析的帳號（共 ${metaAccounts.length} 個）`
            : `已選 ${metaSelected.length} 個帳號`,
    };

    const ga4Status: DataSourceStatus = {
      platform: "ga4",
      connectionStatus: ga4HasProperty ? "connected" : "not_configured",
      syncStatus: ga4Accounts.length > 0 ? "synced" : ga4HasProperty ? "never_synced" : "never_synced",
      selectionStatus: ga4Selected.length > 0 ? "selected" : "none_selected",
      analysisStatus: batch && batch.ga4Metrics.length > 0 ? "analyzed" : "never_analyzed",
      lastSyncedAt: ga4LastSync || null,
      lastAnalyzedAt: refreshStatus.lastAnalysisAt || null,
      accountCount: ga4Accounts.length,
      selectedCount: ga4Selected.length,
      message: !ga4HasProperty
        ? "????? GA4 Property ID"
        : ga4Accounts.length === 0
          ? "請先設定 Property ID 或選擇資源"
          : ga4Selected.length === 0
            ? `請選擇要分析的資源（共 ${ga4Accounts.length} 個）`
            : `????${ga4Selected.length} ????????????`,
    };

    res.json([metaStatus, ga4Status]);
  });

  app.get("/api/status/unified", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const syncedAccounts = storage.getSyncedAccounts(userId);
    const batch = getBatchFromRequest(req);

    const metaAccounts = syncedAccounts.filter((a) => a.platform === "meta" && a.status === "active");
    const ga4Accounts = syncedAccounts.filter((a) => a.platform === "ga4" && a.status === "active");

    const metaHasToken = !!settings.fbAccessToken?.trim();
    let ga4HasKey = false;
    try {
      ga4HasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    } catch {
      /* optional env */
    }
    const ga4HasProperty = !!settings.ga4PropertyId?.trim();

    const hasMeta = metaHasToken && metaAccounts.length > 0;
    const hasGA4 = (ga4HasKey || ga4HasProperty) && ga4Accounts.length > 0;

    const dataCoverage: DataFlowStatus["dataCoverage"] =
      hasMeta && hasGA4 ? "both" : hasMeta ? "meta_only" : hasGA4 ? "ga4_only" : "none";

    const status: DataFlowStatus = {
      connectionStatus: { meta: metaHasToken, ga4: ga4HasKey || ga4HasProperty },
      syncStatus: { metaCount: metaAccounts.length, ga4Count: ga4Accounts.length },
      selectionStatus: {
        metaSelected: batch?.selectedAccountIds?.length || 0,
        ga4Selected: batch?.selectedPropertyIds?.length || 0,
      },
      analysisStatus: {
        lastBatchAt: batch?.generatedAt || null,
        lastBatchScope: batch
          ? buildScopeKey(
              userId,
              batch.selectedAccountIds || [],
              batch.selectedPropertyIds || [],
              batch.dateRange.preset,
              batch.dateRange.preset === "custom" ? batch.dateRange.startDate : undefined,
              batch.dateRange.preset === "custom" ? batch.dateRange.endDate : undefined
            )
          : null,
        isStale: batch ? Date.now() - new Date(batch.generatedAt).getTime() > 24 * 60 * 60 * 1000 : true,
      },
      dataCoverage,
    };

    res.json(status);
  });
}
