import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import session from "express-session";
import { storage } from "./storage";
import { loginSchema, settingsSchema, contentJudgmentInputSchema, contentJudgmentChatRequestSchema, type Workflow, META_ACCOUNT_STATUS_MAP, resolveDateRange, buildScopeKey, detectContentType, contentTypeToJudgmentType } from "@shared/schema";
import type { MetaAdAccount, SyncedAccount, CampaignMetrics, GA4FunnelMetrics, AnalysisBatch, DataSourceStatus, DataFlowStatus, ContentJudgmentResult, PrecomputedActionCenterPayload, PrecomputedScorecardPayload, RefreshJob } from "@shared/schema";
import { BATCH_COMPUTATION_VERSION } from "@shared/schema";
import { randomUUID } from "crypto";
import { callGeminiContentJudgment, callGeminiChat } from "./gemini";
import { buildContentJudgmentUserPrompt } from "./prompt-builder";
import { enrichContentWithUrls } from "./url-scraper";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { syncMetaAccounts, syncGA4Properties } from "./account-sync";
import { fetchMetaCampaignData, fetchMultiWindowMetrics, fetchMetaAdSetAndAdData } from "./meta-data-fetcher";
import { fetchGA4FunnelData, fetchGA4PageData } from "./ga4-data-fetcher";
import { detectCampaignAnomalies, detectGA4Anomalies, identifyRiskyCampaigns, calculateAccountHealth } from "./analysis-engine";
import { computeAccountAvg, calculateCampaignTriScore, classifyRiskLevel, evaluateStopLoss, classifyOpportunities, calculateAccountTriScore, calculatePageTriScore, classifyPageRiskLevel, buildCampaignScoringResult, buildPageScoringResult, buildAccountScoringResult, buildBoardSet } from "./scoring-engine";
import { generateCrossAccountSummary } from "./ai-summary-pipeline";
import {
  buildRealGA4FunnelOverview, buildRealGA4FunnelSegments, buildRealGA4DropPoints,
  buildRealGA4PageRanking, buildRealGA4DirectorSummary, buildRealGA4PriorityFixes, buildRealGA4HighRiskItems,
  buildRealGA4Pages,
  buildRealOpportunities, buildPageRecommendationsArray, buildFunnelDrillDown,
} from "./real-data-transformers";
import { assetRouter } from "./modules/asset/asset-routes";
import { assetPackageRouter } from "./modules/asset/asset-package-routes";
import { assetVersionRouter } from "./modules/asset/asset-version-routes";
import { resolveFilePathForRequest, ensureUploadProviderReady } from "./modules/asset/upload-provider";
import { createDiskStorage, cleanupUploadTempFile } from "./lib/upload-temp";
import { publishRouter } from "./modules/publish/publish-routes";
import { executionRouter } from "./modules/execution/execution-routes";
import { syncRouter } from "./modules/sync/sync-routes";
import { registerMetaConnectRoutes } from "./routes/meta-connect-routes";
import { registerWorkbenchRoutes } from "./routes/workbench-routes";
import { registerDashboardTruthRoutes, getBatchFromRequest } from "./routes/dashboard-truth-routes";
import { registerFbAdsApiRoutes } from "./routes/fb-ads-api-routes";
import { registerCreativeIntelligenceRoutes } from "./routes/creative-intelligence-routes";
import { registerParetoRoutes } from "./routes/pareto-routes";
import { registerJudgmentReviewRoutes } from "./routes/judgment-review-routes";
import { incrementActionCenterFallback, incrementScorecardFallback } from "./precompute-metrics";
import { registerHealthAndDebugRoutes } from "./routes/health-and-debug-routes";
import {
  aggregateByProductWithResolver,
  aggregateByCreativeTagsWithResolver,
  parseCampaignNameToTags,
  getBudgetRecommendation,
  getHistoricalFailureRateByTag,
  clearCampaignParseCache,
  type ProductLevelMetrics,
  type CreativeTagLevelMetrics,
} from "@shared/tag-aggregation-engine";
import { prisma } from "./db";
import { getBuildVersion } from "./version";
import {
  getWorkbenchOwners,
  createWorkbenchTasksBatch,
  getWorkbenchMappingOverrides,
  getWorkbenchMappingRecord,
  resolveProductWithOverrides,
  getPublishedThresholdConfig,
  getPublishedPrompt,
} from "./workbench-db";
import { getAssembledSystemPrompt, buildDataContextSection, suggestUIModeFromJudgmentType, type UIMode, type JudgmentType as AssemblyJudgmentType } from "./rich-bear-prompt-assembly";
import { filterActionCenterPayloadByScope } from "./build-action-center-payload";
import { parseStructuredJudgmentFromResponse } from "./parse-structured-judgment";
import { validateJudgmentAgainstSystemAction } from "./lib/judgment-alignment";
import {
  stitchFunnelData,
  runFunnelDiagnostics,
} from "@shared/funnel-stitching";
import { classifyMaterialTier } from "@shared/material-tier";
import { SCORE_DEFINITIONS } from "@shared/score-definitions";
import { runRefreshJob } from "./refresh-job-runner";
import {
  breakEvenRoas,
  targetRoas,
  DATA_STATUS_NO_DELIVERY,
  DATA_STATUS_UNDER_SAMPLE,
  DATA_STATUS_DECISION_READY,
  EVIDENCE_ADS_ONLY,
  EVIDENCE_GA_VERIFIED,
  EVIDENCE_RULES_MISSING,
  EVIDENCE_INSUFFICIENT_SAMPLE,
  EVIDENCE_NO_DELIVERY,
  type EvidenceLevel,
} from "@shared/schema";
import { getBatchValidity } from "@shared/batch-validity";
import { homepageTruthFieldsForDataConfidence } from "@shared/homepage-data-truth";
import { computeScaleReadiness, getBudgetRecommendation as getScaleBudgetRecommendation, getTrendABC, creativeEdge } from "@shared/scale-score-engine";
import { getProductProfitRules, getProductProfitRule, getProductProfitRuleExplicit, setProductProfitRule } from "./profit-rules-store";
import { getInitialVerdict, setInitialVerdict } from "./initial-verdicts-store";
import { getCampaignDecision, setCampaignDecision, type DecisionAction } from "./campaign-decisions-store";
import {
  computeRoiFunnel,
  computeBaselineFromRows,
  getBaselineFor,
  toRoiRows,
  getSuggestedAction,
  DEFAULT_ROI_FUNNEL_THRESHOLDS,
  type RoiFunnelThresholds,
  type LifecycleLabel,
} from "@shared/roi-funnel-engine";
import { computeLifecycleStage, FIRST_DECISION_SPEND_MIN, FIRST_DECISION_SPEND_MAX } from "@shared/lifecycle-spec";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerFacebookWebhookRoutes } from "./routes/facebook-webhook-routes";
import { SqliteSessionStore } from "./session/sqlite-session-store";
import { getSessionCookieName } from "./session-constants";
import { resolveSessionSecretForApp } from "./session/production-session-secret";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "????" });
  }
  next();
}

/** 取得 req.params 單一 string（Express 可能給 string | string[]） */
function getParam(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

/** 從 batch.precomputedActionCenter 依 campaignId 取得伺服器端系統判定，供 alignment 使用；無法取得時回傳 null（不信任 request body）。 */
function getSystemActionFromBatch(
  batch: AnalysisBatch,
  campaignId: string
): { suggestedAction: string; suggestedPct: number | "關閉" } | null {
  const payload = batch.precomputedActionCenter as (Record<string, unknown> & {
    todayRescue?: Array<{ campaignId?: string; suggestedAction?: string; suggestedPct?: number | "關閉" }>;
    todayScaleUp?: Array<{ campaignId?: string; suggestedAction?: string; suggestedPct?: number | "關閉" }>;
    tableNoMisjudge?: Array<{ campaignId?: string; suggestedAction?: string; suggestedPct?: number | "關閉" }>;
  }) | null | undefined;
  if (!payload || !campaignId) return null;
  const rows = [
    ...(payload.todayRescue ?? []),
    ...(payload.todayScaleUp ?? []),
    ...(payload.tableNoMisjudge ?? []),
  ];
  const rec = rows.find((r) => (r.campaignId ?? "") === campaignId);
  if (!rec || rec.suggestedAction == null) return null;
  return {
    suggestedAction: String(rec.suggestedAction),
    suggestedPct: rec.suggestedPct ?? "關閉",
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  ensureUploadProviderReady();
  const isProd = process.env.NODE_ENV === "production";
  const trustProxy =
    process.env.TRUST_PROXY === "1" ||
    process.env.TRUST_PROXY === "true" ||
    isProd;
  if (trustProxy) {
    app.set("trust proxy", 1);
  }
  const sessionCookieName = getSessionCookieName();
  const secret = resolveSessionSecretForApp();
  const sessionDb = path.join(process.cwd(), ".data", "sessions.sqlite");
  const sessionStore = new SqliteSessionStore(sessionDb);
  app.use(
    session({
      name: sessionCookieName,
      secret,
      store: sessionStore,
      proxy: trustProxy,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  registerAuthRoutes(app, { sessionCookieName, isProd });

  /** 靜態與 WebSocket 等由 server/index.ts 另行掛載 */

  registerHealthAndDebugRoutes(app);

  registerFacebookWebhookRoutes(app);

  app.use("/api/assets", requireAuth, assetRouter);
  app.use("/api/asset-packages", requireAuth, assetPackageRouter);
  app.use("/api/asset-versions", requireAuth, assetVersionRouter);
  app.use("/api/publish", requireAuth, publishRouter);
  app.use("/api/execution", requireAuth, executionRouter);
  app.use("/api/sync", requireAuth, syncRouter);
  registerMetaConnectRoutes(app, requireAuth);
  registerWorkbenchRoutes(app, requireAuth);
  registerDashboardTruthRoutes(app, requireAuth);
  registerCreativeIntelligenceRoutes(app, requireAuth);
  registerParetoRoutes(app, requireAuth);
  registerJudgmentReviewRoutes(app, requireAuth);

  app.get("/api/uploads/:userId/:filename", requireAuth, (req, res) => {
    const sessionUserId = req.session.userId;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    if (!userId || !filename) {
      return res.status(404).json({ message: "?????" });
    }
    if (sessionUserId !== userId) {
      return res.status(403).json({ message: "????????" });
    }
    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {
      decodedFilename = filename;
    }
    const filePath = resolveFilePathForRequest(userId, filename);
    const targetPathSimple = path.resolve(process.cwd(), ".data", "uploads", userId, decodedFilename);
    console.log("\n--- [???????Debug] ---");
    console.log("1. ?????? URL:", req.originalUrl);
    console.log("2. ??????? userId:", userId, "| filename (decoded):", decodedFilename);
    console.log("3. ?? resolveFilePathForRequest ??????:", filePath ?? "(null)");
    console.log("4. ?????? .data/uploads/userId/filename:", targetPathSimple);
    console.log("5. resolveFilePathForRequest ???????? (fs.existsSync)?:", filePath ? fs.existsSync(filePath) : false);
    console.log("6. ????????????", fs.existsSync(targetPathSimple));
    console.log("------------------------\n");
    if (!filePath) {
      return res.status(404).json({ message: "?????" });
    }
    res.sendFile(filePath, { dotfiles: "allow" }, (err: unknown) => {
      if (err) {
        console.error("sendFile error:", err);
        if (!res.headersSent) {
          const status = (err as { status?: number }).status ?? 500;
          res.status(status).end();
        }
      }
    });
  });

  app.post("/api/settings/test-connection", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const type = req.body?.type;
    const valueRaw = req.body?.value;
    const value = typeof valueRaw === "string" ? valueRaw : String(valueRaw ?? "");
    const checkedAt = new Date().toISOString();
    const storageType = type === "ga4" || type === "fb" || type === "ai" ? type : undefined;

    const persistVerification = (success: boolean, lastError?: string | null) => {
      if (storageType) storage.patchVerificationStatus(userId, storageType, { status: success ? "success" : "error", verifiedAt: checkedAt, lastError: success ? null : (lastError ?? null) }, value);
    };

    const sendError = (payload: { message: string; errorCode: string; statusCode?: number; testedModel?: string; productionModel?: string; providerErrorMessage?: string; [k: string]: unknown }) => {
      if (storageType) persistVerification(false, payload.message);
      const statusCode = payload.statusCode && payload.statusCode >= 400 ? payload.statusCode : 200;
      res.status(statusCode).json({
        success: false,
        status: "error",
        checkedAt,
        statusCode,
        ...payload,
      });
    };

    if (!type || !["ga4", "fb", "ai"].includes(type)) {
      return sendError({ message: "????????????", errorCode: "INVALID_TYPE", statusCode: 400 });
    }
    if (!value.trim()) {
      const emptyMessages: Record<string, string> = {
        ai: "???? API Key????????AI ?????API ???",
        fb: "???? Access Token????????Facebook API ??????",
        ga4: "???? Property ID????????GA4 ??? ID",
      };
      return sendError({ message: emptyMessages[type] || "????????", errorCode: "EMPTY_VALUE" });
    }

    try {
      if (type === "ai") {
        const productionModel = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
        const testModel = productionModel;
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(value.trim());
          const model = genAI.getGenerativeModel({ model: testModel });
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000));
          const result = await Promise.race([model.generateContent("hi"), timeoutPromise]);
          const text = result.response.text();
          if (text && text.length > 0) {
            persistVerification(true);
            return res.json({ success: true, status: "success", message: `API Key ???????????????? Gemini API?????????????? ${productionModel}`, testedModel: testModel, productionModel, checkedAt });
          }
          return sendError({ message: "???????????????? API Key ???????", errorCode: "EMPTY_RESPONSE", testedModel: testModel, productionModel });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (errMsg === "TIMEOUT") {
            return sendError({ message: "????????????15 ????????????", errorCode: "TIMEOUT", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
            return sendError({ message: "API Key ????????????????????", errorCode: "API_KEY_INVALID", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("not found") || errMsg.includes("is not found")) {
            return sendError({ message: `??? ${testModel} ?????????????????????`, errorCode: "MODEL_NOT_FOUND", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("permission") || errMsg.includes("PERMISSION_DENIED")) {
            return sendError({ message: "API Key ???????? Gemini API", errorCode: "PERMISSION_DENIED", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            return sendError({ message: "API ??????????????????????????", errorCode: "QUOTA_EXHAUSTED", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("billing") || errMsg.includes("BILLING")) {
            return sendError({ message: "?????????????? Google Cloud ?????", errorCode: "BILLING_ERROR", testedModel: testModel, productionModel, providerErrorMessage });
          }
          return sendError({ message: `AI ??????: ${errMsg.slice(0, 200)}`, errorCode: "AI_ERROR", testedModel: testModel, productionModel, providerErrorMessage });
        }
      }

      if (type === "fb") {
        try {
          const fbRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(value.trim())}`);
          const fbData = await fbRes.json();
          if (fbRes.ok && fbData.id) {
            const name = fbData.name || fbData.id;
            let accountPreview: { totalCount: number; topNames: string[] } | undefined;
            try {
              const acctRes = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status&limit=100&access_token=${encodeURIComponent(value.trim())}`);
              const acctData = await acctRes.json();
              if (acctRes.ok && acctData.data) {
                const accounts = acctData.data as any[];
                accountPreview = {
                  totalCount: accounts.length,
                  topNames: accounts.slice(0, 3).map((a: any) => a.name || a.account_id || "???"),
                };
              }
            } catch {}
            persistVerification(true);
            const acctMsg = accountPreview
              ? `????? ${accountPreview.totalCount} ???${accountPreview.topNames.length > 0 ? ` (${accountPreview.topNames.join("?")}${accountPreview.totalCount > 3 ? "..." : ""})` : ""}`
              : "";
            return res.json({ success: true, status: "success", message: `Facebook ??????????? ${name} (ID: ${fbData.id})${acctMsg}`, accountPreview, checkedAt });
          }
          const fbError = fbData.error;
          if (fbError) {
            if (fbError.code === 190) {
              const subcode = fbError.error_subcode;
              if (subcode === 463 || subcode === 467) {
                persistVerification(false, "Facebook Access Token ??????????????????Token");
                return res.json({ success: false, status: "error", message: "Facebook Access Token ??????????????????Token", errorCode: "FB_TOKEN_EXPIRED", checkedAt });
              }
              persistVerification(false, `Facebook Access Token ????: ${fbError.message}`);
              return res.json({ success: false, status: "error", message: `Facebook Access Token ????: ${fbError.message}`, errorCode: "FB_TOKEN_INVALID", checkedAt });
            }
            if (fbError.code === 10 || fbError.code === 200) {
              persistVerification(false, `Facebook Token ?????: ${fbError.message}`);
              return res.json({ success: false, status: "error", message: `Facebook Token ?????: ${fbError.message}`, errorCode: "FB_PERMISSION_DENIED", checkedAt });
            }
            persistVerification(false, `Facebook API ???: ${fbError.message}`);
            return res.json({ success: false, status: "error", message: `Facebook API ???: ${fbError.message}`, errorCode: "FB_API_ERROR", checkedAt });
          }
          persistVerification(false, "Facebook API ???????????????");
          return res.json({ success: false, status: "error", message: "Facebook API ???????????????", errorCode: "FB_UNKNOWN", checkedAt });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.message?.includes("fetch")) {
            persistVerification(false, "?????????Facebook API??????????");
            return res.json({ success: false, status: "error", message: "?????????Facebook API??????????", errorCode: "NETWORK_ERROR", statusCode: 200, providerErrorMessage, checkedAt });
          }
          persistVerification(false, `Facebook ??????: ${errMsg.slice(0, 200)}`);
          return res.json({ success: false, status: "error", message: `Facebook ??????: ${errMsg.slice(0, 200)}`, errorCode: "FB_ERROR", statusCode: 200, providerErrorMessage, checkedAt });
        }
      }

      if (type === "ga4") {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) {
          persistVerification(false, "GA4 Property ID ?????????????????? (???: 123456789)");
          return res.json({ success: false, status: "error", message: "GA4 Property ID ?????????????????? (???: 123456789)", errorCode: "GA4_FORMAT_INVALID", checkedAt });
        }
        const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!saKeyJson) {
          persistVerification(false, "??????? Service Account ????");
          return res.json({
            success: false,
            status: "error",
            message: `Property ID ${trimmed} ?????????????????? Service Account ???????????????????? GOOGLE_SERVICE_ACCOUNT_KEY?????JSON ???????`,
            errorCode: "GA4_NO_AUTH",
            ga4Detail: { propertyId: trimmed, authConfigured: false },
            checkedAt,
          });
        }
        let credentials: any;
        try {
          credentials = JSON.parse(saKeyJson);
        } catch {
          persistVerification(false, "Service Account ??????????JSON ????????");
          return res.json({ success: false, status: "error", message: "Service Account ??????????JSON ??????????????? GOOGLE_SERVICE_ACCOUNT_KEY ?????????JSON", errorCode: "GA4_CRED_PARSE_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: false }, checkedAt });
        }
        try {
          const { GoogleAuth } = await import("google-auth-library");
          const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
          });
          const client = await auth.getClient();
          const tokenRes = await client.getAccessToken();
          const accessToken = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
          if (!accessToken) {
            persistVerification(false, "???????? Access Token");
            return res.json({ success: false, status: "error", message: "Service Account ??????????????????? Access Token?????????????????", errorCode: "GA4_TOKEN_FAILED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
          }
          const ga4Res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${trimmed}:runReport`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: "yesterday", endDate: "today" }],
              metrics: [{ name: "activeUsers" }],
              limit: 1,
            }),
          });
          const ga4Data = await ga4Res.json();
          if (ga4Res.ok) {
            persistVerification(true);
            const activeUsers = ga4Data.rows?.[0]?.metricValues?.[0]?.value || "0";
            return res.json({
              success: true,
              status: "success",
              message: `GA4 Property ${trimmed} ??????? (Service Account: ${credentials.client_email})?????????? ${activeUsers}`,
              ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email },
              checkedAt,
            });
          }
          const ga4Error = ga4Data.error;
          if (ga4Error) {
            if (ga4Error.status === "UNAUTHENTICATED" || ga4Error.code === 401) {
              persistVerification(false, "Service Account ?????????????????????????");
              return res.json({ success: false, status: "error", message: "Service Account ?????????????????????????", errorCode: "GA4_UNAUTHENTICATED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "PERMISSION_DENIED" || ga4Error.code === 403) {
              const msg = (ga4Error.message || "").toLowerCase();
              if (msg.includes("api not enabled") || msg.includes("has not been used") || msg.includes("analyticsdata")) {
                persistVerification(false, "Google Analytics Data API ?????");
                return res.json({ success: false, status: "error", message: `Google Analytics Data API ???????????Google Cloud Console ??? "Google Analytics Data API" (???: ${credentials.project_id})`, errorCode: "GA4_API_NOT_ENABLED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
              }
              persistVerification(false, `Service Account ??? GA4 Property ${trimmed} ??????????`);
              return res.json({ success: false, status: "error", message: `Service Account (${credentials.client_email}) ??? GA4 Property ${trimmed} ???????????????GA4 ????? > Property Access Management ??????Service Account ?????Viewer ??`, errorCode: "GA4_PERMISSION_DENIED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "NOT_FOUND" || ga4Error.code === 404) {
              persistVerification(false, `GA4 Property ID ${trimmed} ?????`);
              return res.json({ success: false, status: "error", message: `GA4 Property ID ${trimmed} ???????????Property ID ???????`, errorCode: "GA4_NOT_FOUND", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "INVALID_ARGUMENT" || ga4Error.code === 400) {
              persistVerification(false, `GA4 API ??????: ${ga4Error.message}`);
              return res.json({ success: false, status: "error", message: `GA4 API ??????: ${ga4Error.message}`, errorCode: "GA4_INVALID_ARGUMENT", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            persistVerification(false, `GA4 API ???: ${ga4Error.message || ga4Error.status}`);
            return res.json({ success: false, status: "error", message: `GA4 API ???: ${ga4Error.message || ga4Error.status}`, errorCode: "GA4_API_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
          }
          persistVerification(false, "GA4 API ???????????????");
          return res.json({ success: false, status: "error", message: "GA4 API ???????????????", errorCode: "GA4_UNKNOWN", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("network")) {
            persistVerification(false, "?????????Google Analytics API??????????");
            return res.json({ success: false, status: "error", message: "?????????Google Analytics API??????????", errorCode: "NETWORK_ERROR", statusCode: 200, providerErrorMessage, ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          if (errMsg.includes("invalid_grant") || errMsg.includes("Invalid JWT")) {
            persistVerification(false, "Service Account ????????????????????????????");
            return res.json({ success: false, status: "error", message: "Service Account ????????????????????????????", errorCode: "GA4_INVALID_CRED", statusCode: 200, providerErrorMessage, ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          persistVerification(false, `GA4 ??????: ${errMsg.slice(0, 200)}`);
          return res.json({ success: false, status: "error", message: `GA4 ??????: ${errMsg.slice(0, 200)}`, errorCode: "GA4_ERROR", statusCode: 200, providerErrorMessage, ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
        }
      }
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      return res.status(500).json({
        success: false,
        status: "error",
        message: `???????? ${errMsg.slice(0, 200)}`,
        errorCode: "SERVER_ERROR",
        statusCode: 500,
        providerErrorMessage: errMsg.slice(0, 500),
        checkedAt,
      });
    }
  });

  app.post("/api/upload", requireAuth, (req, res) => {
    const fileName = req.body?.fileName || `upload-${Date.now()}.png`;
    const fileType = req.body?.fileType || "image/png";
    const size = req.body?.size || Math.round(Math.random() * 5000000);
    const id = randomUUID().slice(0, 8);
    res.json({
      id,
      fileName,
      fileType,
      url: `https://mock-cdn.example.com/uploads/${id}/${fileName}`,
      size,
    });
  });

  app.post("/api/content-judgment/start", requireAuth, async (req, res) => {
    const result = contentJudgmentInputSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "?????", errors: result.error.flatten() });
    }

    const userId = req.session.userId!;
    const input = result.data;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey;

    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({
        message: "????? AI API Key??????????????????Gemini API Key ?????????",
        errorCode: "NO_API_KEY",
      });
    }

    const contentType = input.detectedType || detectContentType({
      url: input.url || undefined,
      text: input.text || undefined,
    });
    const judgmentType = contentTypeToJudgmentType(contentType);
    const uiMode = suggestUIModeFromJudgmentType(judgmentType as AssemblyJudgmentType);
    const hasUrl = /https?:\/\/\S+/i.test((input.url ?? "").trim());
    const textLen = (input.text ?? "").trim().length;
    const inputSufficient = hasUrl || textLen >= 30;
    if (!inputSufficient) {
      return res.status(400).json({
        message: "?????? 30 ?????????????",
        errorCode: "INPUT_INSUFFICIENT_FOR_AUDIT",
      });
    }
    const publishedMain = await getPublishedPrompt(uiMode);
    const systemPrompt = getAssembledSystemPrompt({
      uiMode,
      customMainPrompt: publishedMain,
      judgmentType: judgmentType as AssemblyJudgmentType,
      workflow: "audit",
    });
    const userPrompt = buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType);

    console.log(`[ContentJudgment] type=${contentType}, judgmentType=${judgmentType}, uiMode=${uiMode}, workflow=audit, purpose=${input.purpose}, depth=${input.depth}`);

    const contentResult = await callGeminiContentJudgment(
      apiKey,
      settings,
      input,
      contentType,
      judgmentType,
      userId,
      { systemPrompt, userPrompt },
    );

    if (!contentResult) {
      return res.status(502).json({
        message: "AI ????????????? API Key ????????????????",
        errorCode: "AI_CALL_FAILED",
      });
    }

    const report = {
      id: `cj-${randomUUID().slice(0, 8)}`,
      contentType,
      judgmentType,
      purpose: input.purpose,
      depth: input.depth,
      createdAt: new Date().toISOString(),
      userId,
      result: contentResult,
    };

    res.json(report);
  });

  const contentJudgmentFileUpload = multer({
    storage: createDiskStorage({ allowedMimePrefixes: ["image/", "video/", "application/pdf", "text/", "application/octet-stream"] }),
    limits: { fileSize: 200 * 1024 * 1024 },
  }).single("file");

  app.post("/api/content-judgment/upload-file", requireAuth, contentJudgmentFileUpload, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey?.trim();
    if (!apiKey) {
      return res.status(400).json({ message: "請先設定 AI API Key", errorCode: "NO_API_KEY" });
    }
    const file = (req as Request & { file?: Express.Multer.File & { path?: string; buffer?: Buffer } }).file;
    if (!file) {
      return res.status(400).json({ message: "請選擇檔案" });
    }
    const tempPath = (file as Express.Multer.File & { path?: string }).path;
    let buffer: Buffer;
    try {
      buffer = file.buffer ?? (tempPath ? await fs.promises.readFile(tempPath) : (null as any));
    } catch {
      if (tempPath) await cleanupUploadTempFile(tempPath);
      return res.status(400).json({ message: "無法讀取上傳檔案" });
    }
    if (!buffer || !Buffer.isBuffer(buffer)) {
      if (tempPath) await cleanupUploadTempFile(tempPath);
      return res.status(400).json({ message: "請選擇檔案" });
    }
    const mimeType = file.mimetype || "application/octet-stream";
    const name = file.originalname || `upload-${Date.now()}`;
    try {
      const fileManager = new GoogleAIFileManager(apiKey);
      const result = await fileManager.uploadFile(buffer, { mimeType, name });
      const fileUri = result.file.name || result.file.uri;
      if (!fileUri) {
        return res.status(502).json({ message: "File API 未回傳 URI" });
      }
      res.json({ fileUri, mimeType, name: result.file.displayName || name });
    } catch (e: any) {
      console.error("[ContentJudgment] upload-file error:", e?.message || e);
      return res.status(502).json({
        message: e?.message?.includes("quota") ? "API 配額不足" : "上傳失敗",
        errorCode: "UPLOAD_FAILED",
      });
    } finally {
      if (tempPath) await cleanupUploadTempFile(tempPath);
    }
  });

  /** ?????????????????????????? workflow ?????????????5 ?????clarify|create|audit|strategy|task */
  function inferWorkflow(content: string): Workflow {
    const t = content.trim().toLowerCase();
    if (/審判|判斷|審核|評估|看|診斷|分析|audit/.test(t)) return "audit";
    if (/創建|產生|製作|產出|生成|寫|建立/.test(t)) return "create";
    if (/策略|方向|建議|怎麼做|戰略|規劃/.test(t)) return "strategy";
    if (/任務|待辦|執行|步驟|清單/.test(t)) return "task";
    return "clarify";
  }

  /** audit ???????????????????URL????????????????????????????????????*/
  function isInputSufficientForAudit(message: { content: string; attachments?: { type: string; url?: string; name?: string }[] }): boolean {
    const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
    const hasUrl = /https?:\/\/\S+/i.test(message.content.trim());
    const minLength = 30;
    const sufficientLength = message.content.trim().length >= minLength;
    return hasAttachments || hasUrl || sufficientLength;
  }

  app.post("/api/content-judgment/chat", requireAuth, async (req, res) => {
    const parsed = contentJudgmentChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "請求無效", errors: parsed.error.flatten() });
    }

    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        message: "????? AI API Key??????????????????Gemini API Key",
        errorCode: "NO_API_KEY",
      });
    }

    try {
      const { sessionId, message, uiMode, workflow: bodyWorkflow, systemAction: bodySystemAction, systemPct: bodySystemPct, contextCampaignId } = parsed.data;
      const effectiveMode: UIMode = uiMode && ["boss", "buyer", "creative"].includes(uiMode) ? (uiMode as UIMode) : "creative";
      const publishedMain = await getPublishedPrompt(effectiveMode);
      const effectiveWorkflow: Workflow = bodyWorkflow && ["clarify", "create", "audit", "strategy", "task"].includes(bodyWorkflow) ? bodyWorkflow : inferWorkflow(message.content);

      if (effectiveWorkflow === "audit" && !isInputSufficientForAudit(message)) {
        const needMoreMsg = "請提供足夠內容（至少 30 字、連結或附檔）以便審判。";
        let session = sessionId ? storage.getReviewSession(sessionId) : undefined;
        if (sessionId && !session) {
          return res.status(404).json({ message: "找不到該工作階段" });
        }
        if (session && session.userId !== userId) {
          return res.status(403).json({ message: "無權存取該工作階段" });
        }
        const now = new Date().toISOString();
        const userMsgId = `msg-${randomUUID().slice(0, 8)}`;
        const userMessage = { id: userMsgId, role: "user" as const, content: message.content, attachments: message.attachments?.map((a) => ({ type: a.type, url: "", name: a.name })), createdAt: now };
        if (!session) {
          session = { id: `rs-${randomUUID().slice(0, 8)}`, userId, title: message.content.slice(0, 50).trim() || "????", messages: [], createdAt: now, updatedAt: now };
        }
        session.messages.push(userMessage);
        const assistantMsgId = `msg-${randomUUID().slice(0, 8)}`;
        session.messages.push({ id: assistantMsgId, role: "assistant" as const, content: needMoreMsg, createdAt: now });
        session.updatedAt = now;
        storage.saveReviewSession(session);
        return res.json({ session, userMessage, assistantMessage: session.messages[session.messages.length - 1], needMoreInput: true, workflow: "audit" });
      }

      const systemPrompt = getAssembledSystemPrompt({
        uiMode: effectiveMode,
        customMainPrompt: publishedMain,
        workflow: effectiveWorkflow,
      });

      let session = sessionId ? storage.getReviewSession(sessionId) : undefined;
      if (sessionId && !session) {
        return res.status(404).json({ message: "找不到該工作階段" });
      }
      if (session && session.userId !== userId) {
        return res.status(403).json({ message: "無權存取該工作階段" });
      }

      const now = new Date().toISOString();
      const userMsgId = `msg-${randomUUID().slice(0, 8)}`;
      const userMessage = {
        id: userMsgId,
        role: "user" as const,
        content: message.content,
        attachments: message.attachments?.map((a) => ({ type: a.type, url: "", name: a.name })),
        createdAt: now,
      };

      if (!session) {
        const title = message.content.slice(0, 50).trim() || "????";
        session = {
          id: `rs-${randomUUID().slice(0, 8)}`,
          userId,
          title,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
      }

      session.messages.push(userMessage);
      const contentForAi = await enrichContentWithUrls(message.content);
      const assistantText = await callGeminiChat(
        apiKey,
        systemPrompt,
        session.messages.slice(0, -1),
        contentForAi,
        message.attachments,
      );

      if (assistantText == null) {
        session.messages.pop();
        return res.status(502).json({
          message: "AI 呼叫失敗或 API Key 無效，請檢查 Gemini API Key",
          errorCode: "AI_CALL_FAILED",
        });
      }

      const assistantMsgId = `msg-${randomUUID().slice(0, 8)}`;
      let structuredJudgment = effectiveWorkflow === "audit" ? parseStructuredJudgmentFromResponse(assistantText) : undefined;
      // 僅在能從 server-side 取得系統判定時才做 alignment，不以 request body 的 systemAction/systemPct 為可信依據（信任邊界見 docs/final-hardening-report.md）
      const batch = getBatchFromRequest(req);
      const serverRec = contextCampaignId && batch ? getSystemActionFromBatch(batch, contextCampaignId) : null;
      if (structuredJudgment && serverRec != null && serverRec.suggestedAction.trim() !== "") {
        const aligned = validateJudgmentAgainstSystemAction(serverRec.suggestedAction, serverRec.suggestedPct, structuredJudgment.nextAction);
        if (aligned.violated) {
          structuredJudgment = { ...structuredJudgment, nextAction: aligned.alignedNextAction };
        }
      }
      const assistantMessage = {
        id: assistantMsgId,
        role: "assistant" as const,
        content: assistantText,
        createdAt: new Date().toISOString(),
        ...(structuredJudgment && { structuredJudgment }),
      };
      session.messages.push(assistantMessage);
      session.updatedAt = new Date().toISOString();
      storage.saveReviewSession(session);

      res.json({ session, userMessage, assistantMessage, workflow: effectiveWorkflow });
    } catch (err) {
      console.error("[POST /api/content-judgment/chat]", err);
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        message: msg || "伺服器錯誤",
        errorCode: "SERVER_ERROR",
      });
    }
  });

  registerFbAdsApiRoutes(app, requireAuth, getBatchFromRequest);

  app.get("/api/ga4/pages", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json([]);
    const search = req.query.search as string | undefined;
    res.json(buildRealGA4Pages(batch.ga4Metrics, search));
  });

  app.get("/api/ga4/funnel-overview", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json(null);
    res.json(buildRealGA4FunnelOverview(batch.ga4Metrics));
  });

  app.get("/api/ga4/funnel-segments", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json([]);
    res.json(buildRealGA4FunnelSegments(batch.ga4Metrics));
  });

  app.get("/api/ga4/funnel-drilldown", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.ga4PageMetrics || batch.ga4PageMetrics.length === 0) return res.json([]);
    res.json(buildFunnelDrillDown(batch.ga4PageMetrics));
  });

  app.get("/api/ga4/drop-points", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json([]);
    res.json(buildRealGA4DropPoints(batch.ga4Metrics));
  });

  app.get("/api/ga4/page-ranking", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json([]);
    res.json(buildRealGA4PageRanking(batch.ga4Metrics));
  });

  app.get("/api/ga4/director-summary", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json(null);
    res.json(buildRealGA4DirectorSummary(batch.ga4Metrics, batch.summary));
  });

  app.get("/api/ga4/priority-fixes", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.ga4Metrics.length === 0) return res.json([]);
    res.json(buildRealGA4PriorityFixes(batch.ga4Metrics));
  });

  app.get("/api/status/data-sources", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const syncedAccounts = storage.getSyncedAccounts(userId);
    const batch = getBatchFromRequest(req);
    const refreshStatus = storage.getRefreshStatus(userId);

    const metaAccounts = syncedAccounts.filter(a => a.platform === "meta");
    const ga4Accounts = syncedAccounts.filter(a => a.platform === "ga4");

    const metaSelected = batch?.selectedAccountIds || [];
    const ga4Selected = batch?.selectedPropertyIds || [];

    const metaHasToken = !!settings.fbAccessToken?.trim();
    const ga4HasProperty = !!settings.ga4PropertyId?.trim();

    const metaLastSync = metaAccounts.length > 0
      ? metaAccounts.reduce((latest, a) => a.lastSyncedAt > latest ? a.lastSyncedAt : latest, "")
      : null;
    const ga4LastSync = ga4Accounts.length > 0
      ? ga4Accounts.reduce((latest, a) => a.lastSyncedAt > latest ? a.lastSyncedAt : latest, "")
      : null;

    const metaStatus: DataSourceStatus = {
      platform: "meta",
      connectionStatus: metaHasToken ? "connected" : "not_configured",
      syncStatus: metaAccounts.length > 0 ? "synced" : (metaHasToken ? "never_synced" : "never_synced"),
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
      syncStatus: ga4Accounts.length > 0 ? "synced" : (ga4HasProperty ? "never_synced" : "never_synced"),
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

    const metaAccounts = syncedAccounts.filter(a => a.platform === "meta" && a.status === "active");
    const ga4Accounts = syncedAccounts.filter(a => a.platform === "ga4" && a.status === "active");

    const metaHasToken = !!settings.fbAccessToken?.trim();
    let ga4HasKey = false;
    try {
      ga4HasKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    } catch {}
    const ga4HasProperty = !!settings.ga4PropertyId?.trim();

    const hasMeta = metaHasToken && metaAccounts.length > 0;
    const hasGA4 = (ga4HasKey || ga4HasProperty) && ga4Accounts.length > 0;

    const dataCoverage: DataFlowStatus["dataCoverage"] =
      hasMeta && hasGA4 ? "both" :
      hasMeta ? "meta_only" :
      hasGA4 ? "ga4_only" : "none";

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
        isStale: batch ? (Date.now() - new Date(batch.generatedAt).getTime()) > 24 * 60 * 60 * 1000 : true,
      },
      dataCoverage,
    };

    res.json(status);
  });

  app.get("/api/settings", requireAuth, (req, res) => {
    const settings = storage.getSettings(req.session.userId!);
    res.json(settings);
  });

  app.get("/api/profit-rules", requireAuth, (_req, res) => {
    res.json(getProductProfitRules());
  });

  app.put("/api/profit-rules", requireAuth, (req, res) => {
    const { productName, ...rule } = req.body as { productName: string; costRatio?: number; targetNetMargin?: number; minSpend?: number; minClicks?: number; minATC?: number; minPurchases?: number };
    if (!productName || typeof productName !== "string") {
      return res.status(400).json({ message: "?????productName" });
    }
    const updated = setProductProfitRule(productName, rule);
    res.json(updated);
  });

  app.get("/api/profit-rules/calculations", requireAuth, (req, res) => {
    const productName = req.query.productName as string;
    const rule = productName ? getProductProfitRule(productName) : null;
    if (!rule) return res.json({ breakEvenRoas: null, targetRoas: null });
    res.json({
      breakEvenRoas: breakEvenRoas(rule.costRatio),
      targetRoas: targetRoas(rule.costRatio, rule.targetNetMargin),
      costRatio: rule.costRatio,
      targetNetMargin: rule.targetNetMargin,
    });
  });

  app.put("/api/settings", requireAuth, (req, res) => {
    const result = settingsSchema.safeParse(req.body);
    if (!result.success) {
      const errPayload = { message: "?????????????", errors: result.error.flatten() };
      console.error("[PUT /api/settings] validation failed", JSON.stringify(result.error.flatten(), null, 2));
      return res.status(400).json(errPayload);
    }
    const settings = storage.saveSettings(req.session.userId!, result.data);
    res.json(settings);
  });

  app.post("/api/refresh", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const datePreset = (req.body.datePreset as string) || "7";
    const customStart = req.body.customStart as string | undefined;
    const customEnd = req.body.customEnd as string | undefined;
    const selectedAccountIds: string[] = req.body.selectedAccountIds || [];
    const selectedPropertyIds: string[] = req.body.selectedPropertyIds || [];

    const scopeKey = buildScopeKey(
      userId,
      selectedAccountIds,
      selectedPropertyIds,
      datePreset,
      datePreset === "custom" ? customStart : undefined,
      datePreset === "custom" ? customEnd : undefined
    );
    const existing = storage.getRunningJobByScopeKey(scopeKey);
    if (existing) {
      return res.json({
        jobId: existing.jobId,
        status: existing.status,
        scopeKey,
        message: "????????????????? jobId ????",
      });
    }

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const job: RefreshJob = {
      jobId,
      userId,
      scopeKey,
      lockKey: scopeKey,
      status: "pending",
      createdAt,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      errorStage: null,
      resultBatchKey: null,
      attemptCount: 1,
      triggerSource: "manual_refresh",
      progressStep: null,
      progressMessage: null,
      datePreset,
      customStart,
      customEnd,
      selectedAccountIds,
      selectedPropertyIds,
    };
    storage.createRefreshJob(job);
    storage.setRefreshStatus(userId, { isRefreshing: true, currentStep: "?????...", progress: 5 });

    res.json({ jobId, status: job.status, scopeKey });

    // ????????job ??????????? loadRefreshJobs ???running?failed????? setTimeout ????
    void runRefreshJob(jobId).catch((err) => {
      console.error("[Refresh] runRefreshJob error:", err);
    });
  });

  app.get("/api/refresh/status", requireAuth, (req, res) => {
    const status = storage.getRefreshStatus(req.session.userId!);
    res.json(status);
  });

  /** 查詢單一 refresh job 狀態。授權：僅允許查詢「自己」的 job，否則等同資訊洩漏（別人可憑 jobId 看到你的 errorMessage、scopeKey、進度）。不可刪除下方 userId 比對。 */
  app.get("/api/refresh/:jobId/status", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const jobId = getParam(req, "jobId");
    const job = storage.getRefreshJob(jobId);
    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: "job not found" });
    }
    res.json({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      errorStage: job.errorStage,
      errorMessage: job.errorMessage,
      resultBatchKey: job.resultBatchKey,
      progressStep: job.progressStep,
      progressMessage: job.progressMessage,
      scopeKey: job.scopeKey,
    });
  });

  app.get("/api/scoring/definitions", requireAuth, (_req, res) => {
    res.json({ definitions: SCORE_DEFINITIONS });
  });

  app.get("/api/dashboard/account-ranking", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) {
      return res.json({ accounts: [] });
    }
    const sorted = [...batch.summary.topPriorityAccounts].sort((a, b) => b.priorityScore - a.priorityScore);
    res.json({ accounts: sorted });
  });

  app.get("/api/dashboard/anomaly-summary", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) {
      return res.json({ anomalies: [], categories: {} });
    }
    const categories = {
      ads: batch.summary.anomalies.filter(a => a.category === "ads"),
      funnel: batch.summary.anomalies.filter(a => a.category === "funnel"),
      tracking: batch.summary.anomalies.filter(a => a.category === "tracking"),
      fatigue: batch.summary.anomalies.filter(a => a.category === "fatigue"),
    };
    res.json({ anomalies: batch.summary.anomalies, categories });
  });

  /** P3-3 ????????????? 1.0?? ???????????? 750??000?????????????????? */
  app.get("/api/dashboard/creative-lifecycle", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const labelFilter = typeof req.query.label === "string" ? req.query.label : undefined;
    const stageFilter = typeof req.query.stage === "string" ? req.query.stage : undefined;
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({
        items: [],
        success: [],
        underfunded: [],
        retired: [],
        inspirationPool: [],
        stages: ["冷啟動", "觀察", "首次決策", "放大", "成熟", "衰退", "退休"],
        firstDecisionSpendMin: FIRST_DECISION_SPEND_MIN,
        firstDecisionSpendMax: FIRST_DECISION_SPEND_MAX,
      });
    }
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);

    const campaignMetrics = batch.campaignMetrics as CampaignMetrics[];
    const campaignById = new Map(campaignMetrics.map((c) => [c.campaignId, c]));
    const totalAccountSpend = campaignMetrics.reduce((s, c) => s + c.spend, 0);
    const totalAccountRevenue = campaignMetrics.reduce((s, c) => s + c.revenue, 0);

    const campaigns = campaignMetrics.map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      clicks: c.clicks,
      addToCart: c.addToCart,
      conversions: c.conversions,
    }));
    const pairs = toRoiRows(campaigns, resolveProduct);
    const rows = pairs.map((p) => p.row);
    const productFilter = (row: { campaignId: string }) => pairs.find((x) => x.row.campaignId === row.campaignId)?.productName ?? null;
    const { baselines, scopeByProduct } = computeBaselineFromRows(rows, productFilter);
    const baselineResult = { baselines, scopeByProduct };
    const rawConfig = await getPublishedThresholdConfig();
    const thresholds: RoiFunnelThresholds = { ...DEFAULT_ROI_FUNNEL_THRESHOLDS, ...(rawConfig as Record<string, number>) };
    const confidenceMultiplier = (level: string) => (level === "high" ? 1 : level === "medium" ? 0.7 : 0.4);

    const success: Array<{ id: string; name: string; roas: number; spend: number; reason: string }> = [];
    const underfunded: Array<{ id: string; name: string; roas: number; spend: number; reason: string }> = [];
    const retired: Array<{ id: string; name: string; roas: number; spend: number; reason: string }> = [];

    const items: Array<{
      id: string;
      name: string;
      roas: number;
      spend: number;
      atc: number;
      purchase: number;
      atc_rate: number;
      purchase_rate: number;
      atcRateBaseline: number;
      purchaseRateBaseline: number;
      confidenceLevel: string;
      label: LifecycleLabel;
      qualityScore: number;
      evidence: import("@shared/roi-funnel-engine").RoiFunnelEvidence;
      reason: string;
      priority: number;
      baseline_scope?: string;
      stage: string;
      scaleReadinessScore: number;
      suggestedAction: string;
      suggestedPct: number | "關閉";
      whyNotMore: string;
      firstReviewVerdict: string;
      battleVerdict: string;
      forBuyer: string;
      forDesign: string;
    }> = [];

    for (const { row, productName } of pairs) {
      const fullCampaign = campaignById.get(row.campaignId);
      const { baseline, scope } = getBaselineFor(productName, row.accountId, baselineResult);
      const result = computeRoiFunnel(row, baseline, thresholds, { baselineScope: scope });
      const action = getSuggestedAction(result.label, result.evidence, thresholds);
      const reason = [result.evidence.funnelPass ? "漏斗過" : "漏斗未過", result.evidence.gateClicks ? "clicks 過" : "clicks 未過", action].filter(Boolean).join("；");
      const impactTwd = row.revenue || row.spend;
      const priority = impactTwd * confidenceMultiplier(result.confidenceLevel) * (result.qualityScore / 100);

      const rule = getProductProfitRule(productName ?? "") ?? undefined;
      const input = {
        spend: row.spend,
        revenue: row.revenue ?? 0,
        roas: row.roas,
        addToCart: row.addToCart ?? 0,
        conversions: row.purchases,
        clicks: row.clicks ?? 0,
        impressions: 0,
        multiWindow: fullCampaign?.multiWindow ?? undefined,
        totalAccountSpend,
        totalAccountRevenue,
        rule,
      };
      const { score, breakdown } = computeScaleReadiness(input);
      const rec = getScaleBudgetRecommendation(input);
      const stage = computeLifecycleStage(row.spend, result.label, breakdown.profitHeadroom);

      const forBuyer = [rec.reason, rec.whyNotMore].filter(Boolean).join("；");
      const forDesign = breakdown.funnelReadiness >= 60
        ? "漏斗達標，可加強 CTA 與轉化"
        : "漏斗未達標，先衝 ATC 與轉化";

      const initialVerdict = getInitialVerdict(row.campaignId);
      const firstReviewVerdictStr = initialVerdict
        ? `分數 ${initialVerdict.score}；${initialVerdict.summary}；${initialVerdict.recommendTest ? "建議再測" : "可觀察"}；${initialVerdict.reason}`
        : "";
      const savedDecision = getCampaignDecision(row.campaignId);

      const item = {
        id: row.campaignId,
        campaignId: row.campaignId,
        name: row.campaignName,
        roas: row.roas,
        spend: row.spend,
        atc: row.addToCart,
        purchase: row.purchases,
        atc_rate: result.evidence.atc_rate,
        purchase_rate: result.evidence.purchase_rate,
        atcRateBaseline: baseline.atcRateBaseline,
        purchaseRateBaseline: baseline.purchaseRateBaseline,
        confidenceLevel: result.confidenceLevel,
        label: result.label,
        qualityScore: result.qualityScore,
        evidence: result.evidence,
        reason,
        priority,
        baseline_scope: scope,
        stage,
        scaleReadinessScore: score,
        suggestedAction: rec.action,
        suggestedPct: rec.suggestedPct,
        whyNotMore: rec.whyNotMore,
        firstReviewVerdict: firstReviewVerdictStr,
        firstReviewScore: initialVerdict?.score ?? null,
        firstReviewRecommendTest: initialVerdict?.recommendTest ?? null,
        battleVerdict: reason,
        forBuyer,
        forDesign,
        savedDecision: savedDecision?.decision ?? null,
      };
      if (labelFilter && result.label !== labelFilter) continue;
      if (stageFilter && stage !== stageFilter) continue;
      items.push(item);

      if (result.label === "Winner") success.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
      else if (result.label === "Underfunded") underfunded.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
      else if (result.label === "Lucky" || result.label === "FunnelWeak" || result.label === "Retired") retired.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
    }

    items.sort((a, b) => b.priority - a.priority);

    const rowsForCreative = campaignMetrics.map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      conversions: c.conversions,
      clicks: c.clicks ?? 0,
      impressions: c.impressions ?? 0,
      frequency: (c as { frequency?: number }).frequency ?? 0,
    }));
    const productLevel = aggregateByProductWithResolver(rowsForCreative, resolveProduct, undefined);
    const creativeRaw = aggregateByCreativeTagsWithResolver(rowsForCreative, resolveProduct, undefined);
    const productAvgRoas = new Map<string, number>();
    for (const p of productLevel) productAvgRoas.set(p.productName, p.spend > 0 ? p.revenue / p.spend : 0);
    const spendThreshold = totalAccountSpend * 0.2;
    const inspirationPool = creativeRaw
      .filter((c) => {
        const avgRoas = productAvgRoas.get(c.productName) ?? 0;
        const edge = creativeEdge(c.roas, avgRoas);
        return edge >= 1.2 && c.conversions > 0 && c.spend >= 10 && (c.spend <= spendThreshold || c.spend < 500);
      })
      .map((c) => {
        const avgRoas = productAvgRoas.get(c.productName) ?? 0;
        const edge = creativeEdge(c.roas, avgRoas);
        const winReason = `Creative Edge ${edge.toFixed(2)}；ROAS ${c.roas.toFixed(2)}；轉化 ${c.conversions}`;
        const extendDirection = "可依商品潛力與素材表現延伸受眾或預算";
        const designTakeaway = "可加強 CTA 與轉化動線";
        return {
          productName: c.productName,
          materialStrategy: c.materialStrategy,
          headlineSnippet: c.headlineSnippet,
          spend: c.spend,
          revenue: c.revenue,
          roas: c.roas,
          creativeEdge: edge,
          winReason,
          extendDirection,
          designTakeaway,
        };
      })
      .sort((a, b) => b.creativeEdge - a.creativeEdge);

    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const apiKey = settings?.aiApiKey?.trim();
    if (apiKey) {
      for (let i = 0; i < Math.min(3, inspirationPool.length); i++) {
        try {
          const ctx = inspirationPool[i];
          const dataCtx = buildDataContextSection({
            productName: ctx.productName,
            spend: ctx.spend,
            revenue: ctx.revenue,
            scaleReadinessScore: undefined,
            suggestedAction: undefined,
            reason: `素材 ${ctx.materialStrategy}；ROAS ${ctx.roas.toFixed(2)}；Creative Edge ${ctx.creativeEdge.toFixed(2)}`,
          });
          const sysPrompt = getAssembledSystemPrompt({
            uiMode: "creative",
            judgmentType: "extension_ideas",
            dataContext: dataCtx,
          });
          const userMsg = "請產出：1. 贏的理由 2. 延伸方向 3. 設計重點。回傳 JSON：{\"winReason\":\"...\",\"extendDirection\":\"...\",\"designTakeaway\":\"...\"}";
          const text = await callGeminiChat(apiKey, sysPrompt, [], userMsg, undefined);
          if (text) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as { winReason?: string; extendDirection?: string; designTakeaway?: string };
              if (typeof parsed.winReason === "string") inspirationPool[i].winReason = parsed.winReason;
              if (typeof parsed.extendDirection === "string") inspirationPool[i].extendDirection = parsed.extendDirection;
              if (typeof parsed.designTakeaway === "string") inspirationPool[i].designTakeaway = parsed.designTakeaway;
            }
          }
        } catch (_) {
          /* ????? */
        }
      }
    }

    res.json({
      items,
      success,
      underfunded,
      retired,
      inspirationPool,
      stages: ["冷啟動", "觀察", "首次決策", "放大", "成熟", "衰退", "退休"],
      firstDecisionSpendMin: FIRST_DECISION_SPEND_MIN,
      firstDecisionSpendMax: FIRST_DECISION_SPEND_MAX,
    });
  });

  /** 儲存創意生命週期首次審判 verdict，需 campaignId */
  app.post("/api/judgment/save-initial-verdict", requireAuth, (req, res) => {
    const body = req.body as { campaignId?: string; score?: number; summary?: string; recommendTest?: boolean; reason?: string };
    const campaignId = body.campaignId?.trim();
    if (!campaignId) {
      return res.status(400).json({ message: "請提供 campaignId" });
    }
    const score = typeof body.score === "number" ? body.score : 0;
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const recommendTest = !!body.recommendTest;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    setInitialVerdict(campaignId, { score, summary, recommendTest, reason });
    res.json({ success: true, campaignId });
  });

  /** ???????????????????????/???/????/?????????????????????????????*/
  app.post("/api/dashboard/creative-lifecycle/decision", requireAuth, (req, res) => {
    const body = req.body as { campaignId?: string; decision?: string };
    const campaignId = body.campaignId?.trim();
    const raw = body.decision?.trim();
    const allowed: DecisionAction[] = ["放大", "觀察", "重剪", "重拍", "退休"];
    if (!campaignId || !raw || !allowed.includes(raw as DecisionAction)) {
      return res.status(400).json({ message: "請提供 campaignId 且 decision 為：放大/觀察/重剪/重拍/退休" });
    }
    setCampaignDecision(campaignId, raw as DecisionAction);
    res.json({ success: true, campaignId, decision: raw });
  });

  /** P4-1 ????/?????????????????????????? luckyRate??funnelPassRate??avgQualityScore */
  app.get("/api/dashboard/scorecard", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const groupBy = (req.query.groupBy as string) === "person" ? "person" : "product";
    if (!batch || !batch.campaignMetrics?.length) {
      res.setHeader("X-Scorecard-Path", "empty");
      return res.json({ items: [], groupBy });
    }
    /** ?????????????????????? batch ????????????????fallback ????????????????? */
    if (batch.precomputedScorecard) {
      res.setHeader("X-Scorecard-Path", "precomputed");
      if (groupBy === "product" && batch.precomputedScorecard.product) {
        return res.json({ items: batch.precomputedScorecard.product.items, groupBy: "product" as const });
      }
      if (groupBy === "person" && batch.precomputedScorecard.person) {
        return res.json(batch.precomputedScorecard.person);
      }
    }
    incrementScorecardFallback();
    console.warn("[Scorecard] Fallback live compute (batch has no precomputedScorecard)");
    res.setHeader("X-Scorecard-Path", "fallback");
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);

    const campaigns = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      clicks: c.clicks,
      addToCart: c.addToCart,
      conversions: c.conversions,
    }));
    const pairs = toRoiRows(campaigns, resolveProduct);
    const rows = pairs.map((p) => p.row);
    const productFilter = (row: { campaignId: string }) => pairs.find((x) => x.row.campaignId === row.campaignId)?.productName ?? null;
    const { baselines, scopeByProduct } = computeBaselineFromRows(rows, productFilter);
    const baselineResult = { baselines, scopeByProduct };
    const rawConfig = await getPublishedThresholdConfig();
    const thresholds: RoiFunnelThresholds = { ...DEFAULT_ROI_FUNNEL_THRESHOLDS, ...(rawConfig as Record<string, number>) };

    const byProduct = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
    for (const { row, productName } of pairs) {
      if (!productName) continue;
      const { baseline } = getBaselineFor(productName, row.accountId, baselineResult);
      const result = computeRoiFunnel(row, baseline, thresholds);
      const cur = byProduct.get(productName) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
      cur.launched += 1;
      if (result.label === "Winner") cur.success += 1;
      else if (result.label === "Underfunded") cur.underfunded += 1;
      else if (result.label === "Lucky" || result.label === "FunnelWeak" || result.label === "Retired") {
        cur.retired += 1;
        const reason = result.label;
        cur.retirementReasons[reason] = (cur.retirementReasons[reason] || 0) + 1;
      }
      if (result.label === "Lucky") cur.lucky += 1;
      if (result.evidence.funnelPass) cur.funnelPass += 1;
      cur.sumQualityScore += result.qualityScore;
      byProduct.set(productName, cur);
    }

    const owners = await getWorkbenchOwners();
    const itemShape = (name: string, stat: { launched: number; success: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }) => {
      const total = stat.launched;
      return {
        name,
        launchedCount: total,
        successCount: stat.success,
        successRate: total > 0 ? Math.round((stat.success / total) * 100) / 100 : 0,
        avgDaysToTarget: "-",
        retirementReasons: Object.entries(stat.retirementReasons).map(([reason, count]) => ({ reason, count })),
        luckyRate: total > 0 ? Math.round((stat.lucky / total) * 100) / 100 : 0,
        funnelPassRate: total > 0 ? Math.round((stat.funnelPass / total) * 100) / 100 : 0,
        avgQualityScore: total > 0 ? Math.round((stat.sumQualityScore / total) * 10) / 10 : 0,
      };
    };
    if (groupBy === "product") {
      const items = Array.from(byProduct.entries()).map(([productName, stat]) => itemShape(productName, stat));
      return res.json({ items: items.sort((a, b) => b.launchedCount - a.launchedCount), groupBy });
    }
    const byBuyer = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
    const byCreative = new Map<string, { launched: number; success: number; underfunded: number; retired: number; lucky: number; funnelPass: number; sumQualityScore: number; retirementReasons: Record<string, number> }>();
    for (const [productName, stat] of byProduct) {
      const o = owners[productName];
      const buyerId = o?.productOwnerId?.trim() || "未指定";
      const creativeId = (o?.creativeOwnerId?.trim() || o?.mediaOwnerId?.trim()) || "未指定";
      const merge = (cur: typeof stat, s: typeof stat) => {
        cur.launched += s.launched;
        cur.success += s.success;
        cur.underfunded += s.underfunded;
        cur.retired += s.retired;
        cur.lucky += s.lucky;
        cur.funnelPass += s.funnelPass;
        cur.sumQualityScore += s.sumQualityScore;
        for (const [r, c] of Object.entries(s.retirementReasons)) cur.retirementReasons[r] = (cur.retirementReasons[r] || 0) + c;
      };
      const bCur = byBuyer.get(buyerId) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
      merge(bCur, stat);
      byBuyer.set(buyerId, bCur);
      const cCur = byCreative.get(creativeId) || { launched: 0, success: 0, underfunded: 0, retired: 0, lucky: 0, funnelPass: 0, sumQualityScore: 0, retirementReasons: {} };
      merge(cCur, stat);
      byCreative.set(creativeId, cCur);
    }
    const itemsByBuyer = Array.from(byBuyer.entries()).map(([name, stat]) => itemShape(name, stat)).sort((a, b) => b.launchedCount - a.launchedCount);
    const itemsByCreative = Array.from(byCreative.entries()).map(([name, stat]) => itemShape(name, stat)).sort((a, b) => b.launchedCount - a.launchedCount);
    res.json({ groupBy: "person", itemsByBuyer, itemsByCreative });
  });

  /** P4-2 ??????priority = impactTwd * confidenceMultiplier * (qualityScore/100)?Lucky/Underfunded ??? action */
  app.get("/api/dashboard/replacement-suggestions", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ suggestions: [] });
    }
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);

    const campaigns = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      clicks: c.clicks,
      addToCart: c.addToCart,
      conversions: c.conversions,
    }));
    const pairs = toRoiRows(campaigns, resolveProduct);
    const rows = pairs.map((p) => p.row);
    const productFilter = (row: { campaignId: string }) => pairs.find((x) => x.row.campaignId === row.campaignId)?.productName ?? null;
    const { baselines, scopeByProduct } = computeBaselineFromRows(rows, productFilter);
    const baselineResult = { baselines, scopeByProduct };
    const rawConfig = await getPublishedThresholdConfig();
    const thresholds: RoiFunnelThresholds = { ...DEFAULT_ROI_FUNNEL_THRESHOLDS, ...(rawConfig as Record<string, number>) };

    const confidenceMultiplier = (level: string) => (level === "high" ? 1 : level === "medium" ? 0.7 : 0.4);
    const suggestions: Array<{
      type: string;
      productName?: string;
      campaignName: string;
      campaignId: string;
      suggestion: string;
      action: string;
      reason: string;
      priority: number;
      qualityScore: number;
      confidenceLevel: string;
    }> = [];

    for (const { row, productName } of pairs) {
      const { baseline } = getBaselineFor(productName, row.accountId, baselineResult);
      const result = computeRoiFunnel(row, baseline, thresholds);
      const action = getSuggestedAction(result.label, result.evidence, thresholds);
      const impactTwd = row.revenue || row.spend;
      const priority = impactTwd * confidenceMultiplier(result.confidenceLevel) * (result.qualityScore / 100);

      if (result.label === "Underfunded") {
        suggestions.push({
          type: "underfunded",
          productName: productName ?? undefined,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          suggestion: "預算不足",
          action: "可考慮提高預算 20～30%，觀察 ROAS 與轉化",
          reason: action,
          priority,
          qualityScore: result.qualityScore,
          confidenceLevel: result.confidenceLevel,
        });
      } else if (result.label === "Lucky") {
        suggestions.push({
          type: "lucky",
          productName: productName ?? undefined,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          suggestion: "樣本不足",
          action: "先達 minClicks/minPurchases/minSpend 再判斷",
          reason: action,
          priority,
          qualityScore: result.qualityScore,
          confidenceLevel: result.confidenceLevel,
        });
      } else if (result.label === "FunnelWeak" || result.label === "Retired") {
        suggestions.push({
          type: result.label === "Retired" ? "retired" : "stalled",
          productName: productName ?? undefined,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          suggestion: result.label === "Retired" ? "退休" : "漏斗弱",
          action: result.label === "Retired" ? "已退休，可替換素材" : "先衝 ATC 與轉化",
          reason: action,
          priority,
          qualityScore: result.qualityScore,
          confidenceLevel: result.confidenceLevel,
        });
      }
    }
    suggestions.sort((a, b) => b.priority - a.priority);
    res.json({ suggestions });
  });

  /** Lucky ?????????????????????????????????????????????????? */
  app.post("/api/dashboard/lucky-tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ created: [], count: 0, message: "尚無資料" });
    }
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const campaigns = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      clicks: c.clicks,
      addToCart: c.addToCart,
      conversions: c.conversions,
    }));
    const pairs = toRoiRows(campaigns, resolveProduct);
    const rows = pairs.map((p) => p.row);
    const productFilter = (row: { campaignId: string }) => pairs.find((x) => x.row.campaignId === row.campaignId)?.productName ?? null;
    const { baselines, scopeByProduct } = computeBaselineFromRows(rows, productFilter);
    const baselineResult = { baselines, scopeByProduct };
    const rawConfig = await getPublishedThresholdConfig();
    const thresholds: RoiFunnelThresholds = { ...DEFAULT_ROI_FUNNEL_THRESHOLDS, ...(rawConfig as Record<string, number>) };

    const luckyItems: Array<{ productName: string | null; campaignName: string; action: string; reason: string }> = [];
    for (const { row, productName } of pairs) {
      const { baseline } = getBaselineFor(productName, row.accountId, baselineResult);
      const result = computeRoiFunnel(row, baseline, thresholds);
      if (result.label !== "Lucky") continue;
      const action = `????????????${thresholds.minClicks} clicks??{thresholds.minPurchases} ????spend ??${thresholds.minSpend} ??????`;
      const reason = getSuggestedAction("Lucky", result.evidence, thresholds);
      luckyItems.push({ productName, campaignName: row.campaignName, action, reason });
    }
    const created = await createWorkbenchTasksBatch(
      luckyItems.map((it) => ({
        productName: it.productName ?? undefined,
        title: `[Lucky] ${it.productName ?? "???"} - ${it.campaignName} 達標建議`,
        action: it.action,
        reason: it.reason,
        assigneeId: null,
        status: "unassigned",
        createdBy: userId,
        notes: "",
      }))
    );
    res.status(201).json({ created, count: created.length, message: "Lucky 任務已建立" });
  });

  /** P4-3 ??????????????unmappedSpend??conflictCount??overrideHitRate ??data_confidence ??????*/
  app.get("/api/dashboard/data-confidence", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const syncedAccounts = storage.getSyncedAccounts(userId);
    const hasSynced =
      syncedAccounts.filter((a: SyncedAccount) => a.platform === "meta").length > 0 ||
      syncedAccounts.filter((a: SyncedAccount) => a.platform === "ga4").length > 0;
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({
        products: [],
        batchUnmappedSpend: 0,
        ...homepageTruthFieldsForDataConfidence(batch ?? null, hasSynced, 0),
      });
    }
    const scopeAccountIds =
      typeof req.query.scopeAccountIds === "string"
        ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const scopeProducts =
      typeof req.query.scopeProducts === "string"
        ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const normalizeAccountId = (id: string) => (id || "").replace(/^act_/, "");
    let rows = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
    }));
    if (scopeAccountIds && scopeAccountIds.length > 0) {
      const accountIdSet = new Set(scopeAccountIds.map(normalizeAccountId));
      rows = rows.filter((r) => accountIdSet.has(normalizeAccountId(r.accountId)));
    }
    const overrides = await getWorkbenchMappingOverrides();
    const parseProduct = (name: string) => parseCampaignNameToTags(name)?.productName ?? null;
    if (scopeProducts && scopeProducts.length > 0) {
      const pset = new Set(scopeProducts);
      rows = rows.filter((row) => {
        const pn = resolveProductWithOverrides(row, overrides, parseProduct);
        return pn != null && pset.has(pn);
      });
    }
    let batchUnmappedSpend = 0;
    const productSpendFromOverride = new Map<string, number>();
    const productSpendTotal = new Map<string, number>();
    for (const row of rows) {
      const productName = resolveProductWithOverrides(row, overrides, parseProduct);
      if (!productName) {
        batchUnmappedSpend += row.spend;
        continue;
      }
      const fromOverride = overrides.has(`campaign:${row.campaignId}`);
      productSpendTotal.set(productName, (productSpendTotal.get(productName) || 0) + row.spend);
      if (fromOverride) productSpendFromOverride.set(productName, (productSpendFromOverride.get(productName) || 0) + row.spend);
    }
    const mappingCtx = await (async () => {
      const resolveProduct = (r: { campaignId: string; campaignName: string }) =>
        resolveProductWithOverrides(r, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
      const creativeToProducts = new Map<string, Set<string>>();
      for (const row of rows) {
        const productName = resolveProduct(row);
        if (!productName) continue;
        const tags = parseCampaignNameToTags(row.campaignName);
        if (!tags) continue;
        const key = `${tags.materialStrategy}\t${tags.headlineSnippet}`;
        if (!creativeToProducts.has(key)) creativeToProducts.set(key, new Set());
        creativeToProducts.get(key)!.add(productName);
      }
      const productConflictCount = new Map<string, number>();
      for (const products of creativeToProducts.values()) {
        if (products.size > 1) for (const p of products) productConflictCount.set(p, (productConflictCount.get(p) || 0) + 1);
      }
      return productConflictCount;
    })();
    const totalMappedSpend = Array.from(productSpendTotal.values()).reduce((a, b) => a + b, 0);
    const products: Array<{
      productName: string;
      unmappedSpend: number;
      conflictCount: number;
      overrideHitRate: number;
      data_confidence: "high" | "medium" | "low";
    }> = [];
    for (const [productName, total] of productSpendTotal) {
      const unmappedSpend = batchUnmappedSpend;
      const conflictCount = mappingCtx.get(productName) || 0;
      const fromOverride = productSpendFromOverride.get(productName) || 0;
      const overrideHitRate = total > 0 ? fromOverride / total : 0;
      const unmappedRatio = totalMappedSpend > 0 ? unmappedSpend / (totalMappedSpend + batchUnmappedSpend) : 0;
      let data_confidence: "high" | "medium" | "low" = "high";
      if (unmappedRatio > 0.2 || conflictCount >= 3) data_confidence = "low";
      else if (unmappedRatio > 0.05 || conflictCount >= 1) data_confidence = "medium";
      products.push({ productName, unmappedSpend, conflictCount, overrideHitRate, data_confidence });
    }
    res.json({
      products,
      batchUnmappedSpend,
      ...homepageTruthFieldsForDataConfidence(batch, hasSynced, rows.length),
    });
  });

  /** P3-1 ???????????????????????????????? anomalies??????????????? scopeAccountIds ??? */
  app.get("/api/dashboard/account-exceptions", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary || !batch.summary.anomalies?.length) {
      return res.json({ accounts: [] });
    }
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? new Set(req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean))
      : null;
    let list = (batch.summary.anomalies ?? []).map((a) => ({ ...a, accountId: (a as { accountId?: string }).accountId ?? "", accountName: (a as { accountName?: string }).accountName ?? "" })) as Array<{ accountId: string; accountName: string; [k: string]: unknown }>;
    if (scopeAccountIds && scopeAccountIds.size > 0) {
      const norm = (id: string) => (id.startsWith("act_") ? id : `act_${id}`);
      list = list.filter((a) => scopeAccountIds.has(a.accountId) || scopeAccountIds.has(norm(a.accountId)));
    }
    const byAccount = new Map<string, { accountId: string; accountName: string; anomalies: typeof list }>();
    for (const a of list) {
      const id = a.accountId || "";
      if (!byAccount.has(id)) byAccount.set(id, { accountId: id, accountName: a.accountName || id, anomalies: [] });
      byAccount.get(id)!.anomalies.push(a);
    }
    const accounts = Array.from(byAccount.values()).map((o) => ({
      accountId: o.accountId,
      accountName: o.accountName,
      anomalyCount: o.anomalies.length,
      anomalies: o.anomalies,
    }));
    res.json({ accounts });
  });

  app.get("/api/dashboard/ai-recommendations", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) {
      return res.json({ recommendations: null });
    }
    res.json({
      recommendations: batch.summary.weeklyRecommendations,
      urgentActions: batch.summary.urgentActions,
    });
  });

  /** ???????????????????????? ??????????????P2 ?? mapping overrides?single source of truth??*/
  app.get("/api/dashboard/action-center", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const scopeProducts = typeof req.query.scopeProducts === "string"
      ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const useOverrides = req.query.useOverrides !== "false";

    if (!batch || !batch.campaignMetrics || batch.campaignMetrics.length === 0) {
      res.setHeader("X-ActionCenter-Path", "empty");
      const batchValidity = getBatchValidity(batch ?? null);
      const emptySourceMeta = {
        batchId: batch?.batchId ?? null,
        generatedAt: batch?.generatedAt ?? null,
        dateRange: batch?.dateRange ? (typeof batch.dateRange === "object" && "preset" in batch.dateRange ? (batch.dateRange as { preset?: string }).preset : "") : null,
        scopeKey: null,
        campaignCountUsed: 0,
        excludedNoDelivery: 0,
        excludedUnderSample: 0,
        unmappedCount: 0,
      };
      return res.json({
        batchValidity: batchValidity.validity,
        batchValidityReason: batchValidity.reason,
        sourceMeta: emptySourceMeta,
        productLevel: [],
        productLevelMain: [],
        productLevelNoDelivery: [],
        productLevelUnmapped: [],
        unmappedCount: 0,
        creativeLeaderboard: [],
        creativeLeaderboardUnderSample: [],
        hiddenGems: [],
        urgentStop: [],
        riskyCampaigns: [],
        failureRatesByTag: {},
        budgetActionTable: [],
        budgetActionNoDelivery: [],
        budgetActionUnderSample: [],
        tableRescue: [],
        tableScaleUp: [],
        tableNoMisjudge: [],
        tableExtend: [],
        todayActions: [],
        tierMainAccount: [],
        tierHighPotentialCreatives: [],
        tierNoise: [],
        funnelEvidence: false,
      });
    }
    /** ???????????????????????scope filter?????batch ????????????????fallback ????????????????? */
    if (batch.precomputedActionCenter) {
      const filtered = filterActionCenterPayloadByScope(
        batch.precomputedActionCenter,
        scopeAccountIds,
        scopeProducts
      );
      const hasScope = (scopeAccountIds?.length ?? 0) > 0 || (scopeProducts?.length ?? 0) > 0;
      res.setHeader("X-ActionCenter-Path", "precomputed");
      res.setHeader("X-ActionCenter-Scoped", hasScope ? "yes" : "no");
      return res.json(filtered);
    }
    incrementActionCenterFallback();
    console.warn("[ActionCenter] Fallback live compute (batch has no precomputedActionCenter)");
    res.setHeader("X-ActionCenter-Path", "fallback");
    res.setHeader("X-ActionCenter-Scoped", ((scopeAccountIds?.length ?? 0) > 0 || (scopeProducts?.length ?? 0) > 0) ? "yes" : "no");

    const normalizeAccountId = (id: string) => (id || "").replace(/^act_/, "");
    const accountIdSet =
      scopeAccountIds && scopeAccountIds.length > 0
        ? new Set(scopeAccountIds.map(normalizeAccountId))
        : null;

    let rows = batch.campaignMetrics.map((c: CampaignMetrics) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      frequency: c.frequency,
    }));

    if (accountIdSet && accountIdSet.size > 0) {
      rows = rows.filter((r: { accountId: string }) => accountIdSet.has(normalizeAccountId(r.accountId)));
    }

    const overrides = useOverrides ? await getWorkbenchMappingOverrides() : new Map<string, string>();
    /** ??????????????????????????????????????????????????????*/
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(
        row,
        overrides,
        (name) => parseCampaignNameToTags(name)?.productName ?? "未分類"
      );

    const productLevel: ProductLevelMetrics[] = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const creativeRaw: CreativeTagLevelMetrics[] = aggregateByCreativeTagsWithResolver(rows, resolveProduct, scopeProducts);
    const totalRevenue = productLevel.reduce((s, p) => s + p.revenue, 0);
    const seedHash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
      return Math.abs(h);
    };
    const totalAccountSpend = (batch.campaignMetrics as CampaignMetrics[]).reduce((s, c) => s + c.spend, 0);
    const totalAccountRevenue = (batch.campaignMetrics as CampaignMetrics[]).reduce((s, c) => s + c.revenue, 0);
    const campaignList = accountIdSet
      ? (batch.campaignMetrics as CampaignMetrics[]).filter((c) => accountIdSet.has(normalizeAccountId(c.accountId)))
      : (batch.campaignMetrics as CampaignMetrics[]);

    /** ???????????????/ ?????? / ??????? lifecycle ????????????decision_ready??*/
    const getDataStatus = (
      spend: number,
      impressions: number,
      confidenceScore: number
    ): "no_delivery" | "under_sample" | "decision_ready" => {
      if (spend === 0 || (impressions ?? 0) === 0) return DATA_STATUS_NO_DELIVERY as "no_delivery";
      if (confidenceScore < 40) return DATA_STATUS_UNDER_SAMPLE as "under_sample";
      return DATA_STATUS_DECISION_READY as "decision_ready";
    };

    const budgetActionTable = campaignList.map((c) => {
      const productName = resolveProduct(c) ?? "未分類";
      const rule = getProductProfitRule(productName);
      const explicitRule = getProductProfitRuleExplicit(productName);
      const hasRule = explicitRule != null;
      const input = {
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        addToCart: c.addToCart ?? 0,
        conversions: c.conversions,
        clicks: c.clicks,
        impressions: c.impressions,
        multiWindow: c.multiWindow ?? undefined,
        totalAccountSpend,
        totalAccountRevenue,
        rule,
      };
      const { score, breakdown, trendSignals } = computeScaleReadiness(input);
      const rec = getScaleBudgetRecommendation(input);
      const trendABC = getTrendABC(c.multiWindow ?? undefined, breakEvenRoas(rule.costRatio));
      const impactAmount = c.revenue - c.spend;
      const confidenceScore = breakdown.confidenceScore;
      const sampleStatusLabel = confidenceScore >= 70 ? "足" : confidenceScore >= 40 ? "中" : "低";
      const dataStatus = getDataStatus(c.spend, c.impressions ?? 0, confidenceScore);
      const beRoas = breakEvenRoas(rule.costRatio);
      const tgtRoas = targetRoas(rule.costRatio, rule.targetNetMargin);
      const mw = c.multiWindow;
      /** Phase 2A Guardrail 2???????????????????????????????*/
      const scaleAction = rec.action;
      const suggestedAction =
        !hasRule && (scaleAction === "可加碼" || scaleAction === "高潛延伸")
          ? "維持"
          : scaleAction;
      const reason =
        !hasRule && (scaleAction === "可加碼" || scaleAction === "高潛延伸")
          ? "尚未設定利潤規則，僅顯示維持"
          : rec.reason;
      /** Phase 2A Guardrail 3?evidenceLevel ??? */
      let evidenceLevel: EvidenceLevel;
      if (dataStatus === "no_delivery") evidenceLevel = EVIDENCE_NO_DELIVERY;
      else if (dataStatus === "under_sample") evidenceLevel = EVIDENCE_INSUFFICIENT_SAMPLE;
      else if (!hasRule) evidenceLevel = EVIDENCE_RULES_MISSING;
      else evidenceLevel = EVIDENCE_ADS_ONLY;
      return {
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        accountId: c.accountId,
        productName,
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        addToCart: c.addToCart ?? 0,
        conversions: c.conversions,
        impactAmount,
        sampleStatus: sampleStatusLabel,
        dataStatus,
        evidenceLevel,
        scaleReadinessScore: score,
        profitHeadroom: breakdown.profitHeadroom,
        breakEvenRoas: beRoas < 1e6 ? beRoas : null,
        targetRoas: tgtRoas < 1e6 ? tgtRoas : null,
        roas1d: mw?.window1d?.roas ?? null,
        roas3d: mw?.window3d?.roas ?? null,
        roas7d: mw?.window7d?.roas ?? null,
        trendABC,
        trendCore: trendSignals.trendCore,
        momentum: trendSignals.momentum,
        suggestedAction,
        suggestedPct: rec.suggestedPct,
        reason,
        whyNotMore: rec.whyNotMore,
        hasRule,
        costRuleStatus: hasRule ? "已設定" : "未設定",
      };
    });

    const productAvgRoasByProduct = new Map<string, number>();
    for (const p of productLevel) {
      productAvgRoasByProduct.set(p.productName, p.spend > 0 ? p.revenue / p.spend : 0);
    }
    /** ?????????????> 0????????????????????Phase 2A ??evidenceLevel?????????????????*/
    const creativeRawDecisionReady = creativeRaw.filter((c) => c.spend > 0);
    const creativeLeaderboardRaw = creativeRawDecisionReady.map((c) => {
      const seed = seedHash(`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}`);
      const thumbnailUrl = `https://picsum.photos/seed/${seed}/120/90`;
      const budgetSuggestion = getBudgetRecommendation(c.spend, c.roas) ?? undefined;
      const materialTier = classifyMaterialTier(
        c.spend,
        c.impressions ?? 0,
        c.clicks ?? 0,
        c.conversions,
        c.roas,
        c.revenue,
        totalRevenue
      );
      const rule = getProductProfitRule(c.productName);
      const input = {
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        addToCart: 0,
        conversions: c.conversions,
        clicks: c.clicks ?? 0,
        impressions: c.impressions ?? 0,
        totalAccountSpend,
        totalAccountRevenue,
        rule,
      };
      const { score, breakdown } = computeScaleReadiness(input);
      const rec = getScaleBudgetRecommendation(input);
      const productAvgRoas = productAvgRoasByProduct.get(c.productName) ?? 0;
      const edge = creativeEdge(c.roas, productAvgRoas);
      const evidenceLevel: EvidenceLevel =
        breakdown.confidenceScore < 40 ? EVIDENCE_INSUFFICIENT_SAMPLE : EVIDENCE_ADS_ONLY;
      return {
        ...c,
        thumbnailUrl,
        budgetSuggestion,
        materialTier,
        impressions: c.impressions ?? 0,
        clicks: c.clicks ?? 0,
        scaleReadinessScore: score,
        funnelReadiness: breakdown.funnelReadiness,
        suggestedAction: rec.action,
        suggestedPct: rec.suggestedPct,
        budgetReason: rec.reason,
        whyNotMore: rec.whyNotMore,
        productAverageRoas: productAvgRoas,
        creativeEdge: edge,
        evidenceLevel,
        confidenceScore: breakdown.confidenceScore,
      };
    });
    /** ????????????????????????????????*/
    const creativeLeaderboard = [...creativeLeaderboardRaw]
      .filter((c) => (c as { evidenceLevel: EvidenceLevel }).evidenceLevel !== EVIDENCE_INSUFFICIENT_SAMPLE)
      .sort((a, b) => (a.productName === "未分類" ? 1 : b.productName === "未分類" ? -1 : 0));
    const creativeLeaderboardUnderSample = creativeLeaderboardRaw.filter(
      (c) => (c as { evidenceLevel: EvidenceLevel }).evidenceLevel === EVIDENCE_INSUFFICIENT_SAMPLE
    );
    const failureRatesByTag = getHistoricalFailureRateByTag(rows);

    const totalSpend = productLevel.reduce((s, p) => s + p.spend, 0);
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const sortedBySpend = [...productLevel].sort((a, b) => a.spend - b.spend);
    const medianSpend = sortedBySpend.length > 0
      ? sortedBySpend[Math.floor(sortedBySpend.length / 2)]!.spend
      : 0;

    const hiddenGems = productLevel.filter(
      (p) => p.spend > 0 && p.roas >= avgRoas && (avgRoas > 0 && p.spend <= medianSpend * 1.5)
    ).map((p) => ({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      message: `ROAS ${p.roas.toFixed(2)} 達標，花費偏低可觀察放大`,
    }));

    const urgentStop = rows.filter(
      (r: { spend: number; conversions: number }) => r.spend >= 500 && r.conversions === 0
    ).map((r: { campaignId: string; campaignName: string; accountId: string; spend: number }) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      accountId: r.accountId,
      spend: r.spend,
      message: "高花費零轉化，建議先停",
    }));

    let riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }> = [];
    if (batch.riskyCampaigns && batch.riskyCampaigns.length > 0) {
      const filteredIds = new Set(rows.map((r: { campaignId: string }) => r.campaignId));
      riskyCampaigns = batch.riskyCampaigns
        .filter((r) => r.spend > 0 && filteredIds.has(r.campaignId))
        .map((r) => ({
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          accountId: r.accountId,
          spend: r.spend,
          revenue: r.revenue,
          suggestion: r.suggestion === "stop" ? "建議停投" : r.suggestion === "observe" ? "觀察" : "維持",
        }));
    }

    const productNames = productLevel.map((p) => p.productName);
    const ga4Rows: Array<{ productName: string; sessions: number; bounceRate: number; addToCart: number; purchases: number }> = [];
    const fbRows = productLevel.map((p) => ({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      impressions: p.impressions,
      clicks: p.clicks,
      conversions: p.conversions,
    }));
    if (fbRows.length > 0) {
      fbRows[0].impressions = 10000;
      fbRows[0].clicks = 500;
    }
    const funnelRows = stitchFunnelData(fbRows, ga4Rows);
    const funnelEvidence = false;
    const funnelWarnings = runFunnelDiagnostics(funnelRows, { funnelEvidence });

    const tierMain = productLevel.filter((p) => {
      const revShare = totalRevenue > 0 ? p.revenue / totalRevenue : 0;
      return revShare >= 0.15 && p.roas >= 1;
    }).sort((a, b) => b.revenue - a.revenue);

    /** Phase 2A Guardrail 1???????? decision_ready?????no_delivery??under_sample??*/
    const budgetActionDecisionReady = budgetActionTable.filter(
      (r) =>
        (r as { spend: number }).spend > 0 &&
        (r as { dataStatus: string }).dataStatus === DATA_STATUS_DECISION_READY
    );
    const budgetActionUnderSample = budgetActionTable.filter(
      (r) => (r as { dataStatus: string }).dataStatus === DATA_STATUS_UNDER_SAMPLE
    );
    const budgetActionNoDelivery = budgetActionTable.filter(
      (r) => (r as { dataStatus: string }).dataStatus === DATA_STATUS_NO_DELIVERY
    );
    /** ??????????????????? */
    const excludeUnmapped = (r: { productName?: string }) => (r.productName ?? "") !== "未分類";
    const tableRescue = budgetActionDecisionReady
      .filter((r) => (r.suggestedAction === "先降" || r.suggestedPct === "關閉") && excludeUnmapped(r))
      .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }))
      .sort((a, b) => b.spend - a.spend);
    const tableScaleUp = budgetActionDecisionReady
      .filter(
        (r) =>
          excludeUnmapped(r) &&
          (r.suggestedAction === "可加碼" || r.suggestedAction === "高潛延伸") && (r as { hasRule: boolean }).hasRule === true
      )
      .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }));
    const tableNoMisjudge = budgetActionDecisionReady
      .filter((r) => r.suggestedAction === "維持" && excludeUnmapped(r))
      .map((r) => ({ ...r, whyNotMore: (r as { whyNotMore?: string }).whyNotMore }));
    const creativeWithEdge = creativeLeaderboard as Array<{ productName: string; spend: number; revenue: number; roas: number; conversions: number; scaleReadinessScore?: number; funnelReadiness?: number; creativeEdge?: number; [k: string]: unknown }>;
    const spendThreshold = totalAccountSpend * 0.2;
    const tableExtend = creativeWithEdge.filter((c) => {
      if (c.productName === "未分類") return false;
      const edge = c.creativeEdge ?? 0;
      const funnelOk = (c.funnelReadiness ?? 0) >= 50 || c.conversions > 0;
      const sampleOk = c.conversions > 0 && c.spend >= 10;
      const lowSpend = c.spend <= spendThreshold || c.spend < 500;
      return edge >= 1.2 && funnelOk && sampleOk && lowSpend;
    }).sort((a, b) => (b.creativeEdge ?? 0) - (a.creativeEdge ?? 0));

    const tierNoise = tableRescue.map((r) => ({ campaignId: r.campaignId, campaignName: r.campaignName, productName: r.productName, spend: r.spend, reason: r.reason }));
    const tierHighPotential = tableExtend.slice(0, 10).map((c) => ({ ...c, revenue: c.revenue }));

    /** Phase 2B????????????5 ????????????????????????41??*/
    const buildDirectorVerdict = (
      typeLabel: string,
      reason: string,
      action: string,
      pct: number | "關閉",
      whyNotMore?: string | null
    ): string => {
      const actionStr = pct === "關閉" ? "關閉" : `${action} ${pct}%`;
      const parts = [`${typeLabel}：${reason}。建議 ${actionStr}`];
      if (whyNotMore && String(whyNotMore).trim()) parts.push(String(whyNotMore).trim());
      return parts.join("。");
    };
    type TodayActionRow = {
      type: "止血" | "放大" | "觀察" | "維持" | "高潛延伸";
      objectType: "活動" | "素材" | "商品";
      productName: string;
      campaignName?: string;
      campaignId?: string;
      accountId?: string;
      spend: number;
      revenue: number;
      roas: number;
      breakEvenRoas?: number | null;
      targetRoas?: number | null;
      roas1d?: number | null;
      roas3d?: number | null;
      roas7d?: number | null;
      suggestedAction: string;
      suggestedPct: number | "關閉";
      evidenceLevel: EvidenceLevel;
      reason: string;
      whyNotMore?: string | null;
      directorVerdict: string;
    };
    const todayRescue: TodayActionRow[] = tableRescue.slice(0, 2).map((r) => ({
      type: "止血",
      objectType: "活動" as const,
      productName: r.productName,
      campaignName: r.campaignName,
      campaignId: r.campaignId,
      accountId: r.accountId,
      spend: r.spend,
      revenue: r.revenue ?? 0,
      roas: r.roas,
      breakEvenRoas: r.breakEvenRoas ?? null,
      targetRoas: r.targetRoas ?? null,
      roas1d: r.roas1d ?? null,
      roas3d: r.roas3d ?? null,
      roas7d: r.roas7d ?? null,
      suggestedAction: r.suggestedAction,
      suggestedPct: r.suggestedPct,
      evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
      reason: r.reason,
      whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
      directorVerdict: buildDirectorVerdict("止血", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
    }));
    const todayScaleUp: TodayActionRow[] = tableScaleUp.slice(0, 2).map((r) => ({
      type: "放大",
      objectType: "活動" as const,
      productName: r.productName,
      campaignName: r.campaignName,
      campaignId: r.campaignId,
      accountId: r.accountId,
      spend: r.spend,
      revenue: r.revenue ?? 0,
      roas: r.roas,
      breakEvenRoas: r.breakEvenRoas ?? null,
      targetRoas: r.targetRoas ?? null,
      roas1d: r.roas1d ?? null,
      roas3d: r.roas3d ?? null,
      roas7d: r.roas7d ?? null,
      suggestedAction: r.suggestedAction,
      suggestedPct: r.suggestedPct,
      evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
      reason: r.reason,
      whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
      directorVerdict: buildDirectorVerdict("放大", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
    }));
    const todayNoMisjudge: TodayActionRow[] = tableNoMisjudge.slice(0, 1).map((r) => ({
      type: "維持",
      objectType: "活動" as const,
      productName: r.productName,
      campaignName: r.campaignName,
      campaignId: r.campaignId,
      accountId: r.accountId,
      spend: r.spend,
      revenue: r.revenue ?? 0,
      roas: r.roas,
      breakEvenRoas: r.breakEvenRoas ?? null,
      targetRoas: r.targetRoas ?? null,
      roas1d: r.roas1d ?? null,
      roas3d: r.roas3d ?? null,
      roas7d: r.roas7d ?? null,
      suggestedAction: r.suggestedAction,
      suggestedPct: r.suggestedPct,
      evidenceLevel: (r as { evidenceLevel?: EvidenceLevel }).evidenceLevel ?? EVIDENCE_ADS_ONLY,
      reason: r.reason,
      whyNotMore: (r as { whyNotMore?: string }).whyNotMore ?? null,
      directorVerdict: buildDirectorVerdict("維持", r.reason, r.suggestedAction, r.suggestedPct, (r as { whyNotMore?: string }).whyNotMore),
    }));
    const todayExtend: TodayActionRow[] = tableExtend.slice(0, 2).map((c) => {
      const r = c as typeof c & { budgetReason?: string; whyNotMore?: string; productName: string; spend: number; revenue: number; roas: number };
      return {
        type: "高潛延伸" as const,
        objectType: "素材" as const,
        productName: r.productName,
        campaignName: undefined,
        campaignId: undefined,
        accountId: undefined,
        spend: r.spend,
        revenue: r.revenue ?? 0,
        roas: r.roas,
        breakEvenRoas: null,
        targetRoas: null,
        roas1d: null,
        roas3d: null,
        roas7d: null,
        suggestedAction: typeof r.suggestedAction === "string" ? r.suggestedAction : "維持",
        suggestedPct: (r.suggestedPct as number | "關閉") ?? 0,
        evidenceLevel: (r.evidenceLevel as EvidenceLevel) ?? EVIDENCE_ADS_ONLY,
        reason: r.budgetReason ?? "Creative Edge 達標可延伸",
        whyNotMore: r.whyNotMore ?? null,
        directorVerdict: `${r.budgetReason ?? "Creative Edge 達標"}；${r.whyNotMore ?? "可考慮延伸受眾或預算"}`,
      };
    });
    const todayActions: TodayActionRow[] = [...todayRescue, ...todayScaleUp, ...todayNoMisjudge, ...todayExtend].slice(0, 5);

    /** ?????????hasRule / costRuleStatus / evidenceLevel / breakEvenRoas / targetRoas / profitHeadroom?Phase 3 ?????????? */
    const productLevelWithRule = productLevel.map((p) => {
      const hasRule = getProductProfitRuleExplicit(p.productName) != null;
      const rule = getProductProfitRule(p.productName);
      const beRoas = breakEvenRoas(rule.costRatio);
      const tgtRoas = targetRoas(rule.costRatio, rule.targetNetMargin);
      const profitHeadroom = hasRule && typeof tgtRoas === "number" && tgtRoas < 1e6 && tgtRoas > 0
        ? (p.roas / tgtRoas) - 1
        : null;
      let evidenceLevel: EvidenceLevel;
      if (p.productName === "未分類") evidenceLevel = EVIDENCE_RULES_MISSING;
      else if (p.spend === 0) evidenceLevel = EVIDENCE_NO_DELIVERY;
      else if (!hasRule) evidenceLevel = EVIDENCE_RULES_MISSING;
      else evidenceLevel = EVIDENCE_ADS_ONLY;
      return {
        ...p,
        hasRule,
        costRuleStatus: hasRule ? "已設定" : "未設定",
        evidenceLevel,
        breakEvenRoas: beRoas < 1e6 ? beRoas : null,
        targetRoas: tgtRoas < 1e6 ? tgtRoas : null,
        profitHeadroom,
      };
    });
    /** 僅顯示花費>0、ROAS>0、有規則的 product，其餘由 guardrail 過濾 */
    const productLevelMain = productLevelWithRule.filter(
      (p) => p.spend > 0 && p.productName !== "未分類" && p.roas > 0 && p.hasRule === true
    );
    const productLevelNoDelivery = productLevelWithRule.filter((p) => p.spend === 0);
    const productLevelUnmapped = productLevelWithRule.filter((p) => p.productName === "未分類");

    const batchValidityResult = getBatchValidity(batch);
    const scopeKey = [scopeAccountIds?.join(",") ?? "", scopeProducts?.join(",") ?? ""].filter(Boolean).join("|") || undefined;
    const dr = batch.dateRange as { preset?: string; label?: string } | undefined;
    const sourceMeta = {
      batchId: batch.batchId,
      generatedAt: batch.generatedAt,
      dateRange: dr?.preset ?? dr?.label ?? "",
      scopeKey: scopeKey ?? null,
      campaignCountUsed: rows.length,
      excludedNoDelivery: budgetActionNoDelivery.length,
      excludedUnderSample: budgetActionUnderSample.length,
      unmappedCount: productLevelUnmapped.length,
    };
    res.json({
      batchValidity: batchValidityResult.validity,
      batchValidityReason: batchValidityResult.reason,
      sourceMeta,
      productLevel: productLevelWithRule,
      productLevelMain,
      productLevelNoDelivery,
      productLevelUnmapped,
      unmappedCount: productLevelUnmapped.length,
      creativeLeaderboard,
      creativeLeaderboardUnderSample,
      hiddenGems,
      urgentStop,
      riskyCampaigns,
      funnelWarnings,
      failureRatesByTag,
      budgetActionTable,
      budgetActionNoDelivery,
      budgetActionUnderSample,
      tableRescue,
      tableScaleUp,
      tableNoMisjudge,
      tableExtend,
      todayActions,
      tierMainAccount: tierMain,
      tierHighPotentialCreatives: tierHighPotential,
      tierNoise: tierNoise.slice(0, 20),
      funnelEvidence,
    });
  });

  /** ???AI ??????Mock???????????????????????????*/
  app.post("/api/dashboard/audit-creative", requireAuth, (req, res) => {
    const body = req.body as { thumbnailUrl?: string; roas?: number; spend?: number; productName?: string; materialStrategy?: string; headlineSnippet?: string };
    const roas = typeof body.roas === "number" ? body.roas : 0.5;
    const spend = typeof body.spend === "number" ? body.spend : 5000;
    const productName = body.productName ?? "未分類";
    const materialStrategy = body.materialStrategy ?? "一般";
    const headlineSnippet = body.headlineSnippet ?? "無";
    const verdict = `AI 審判：花費 ${spend.toLocaleString()}、ROAS ${roas.toFixed(2)}。建議先看數據再決定是否放大；若樣本不足則先觀察。`;
    res.json({ verdict });
  });

  /** ?????Campaign ???? + mapping overrides ???????????? */
  app.get("/api/dashboard/product-names", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const set = new Set<string>();
    if (batch?.campaignMetrics?.length) {
      for (const c of batch.campaignMetrics) {
        const tags = parseCampaignNameToTags(c.campaignName);
        if (tags?.productName) set.add(tags.productName);
      }
    }
    const overrides = await getWorkbenchMappingRecord();
    for (const p of Object.values(overrides)) {
      if (p) set.add(p);
    }
    res.json({ productNames: Array.from(set).sort() });
  });

  app.get("/api/ga4/pages-detailed", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.ga4PageMetrics || batch.ga4PageMetrics.length === 0) {
      return res.json({ pages: [], pageGroups: [] });
    }
    const pages = batch.ga4PageMetrics;
    const groupMap = new Map<string, { group: string; count: number; totalSessions: number; totalRevenue: number; avgConversionRate: number; avgBounceRate: number }>();
    for (const p of pages) {
      const g = groupMap.get(p.pageGroup) || { group: p.pageGroup, count: 0, totalSessions: 0, totalRevenue: 0, avgConversionRate: 0, avgBounceRate: 0 };
      g.count++;
      g.totalSessions += p.sessions;
      g.totalRevenue += p.revenue;
      g.avgConversionRate += p.conversionRate;
      g.avgBounceRate += p.bounceRate;
      groupMap.set(p.pageGroup, g);
    }
    const pageGroups = Array.from(groupMap.values()).map(g => ({
      ...g,
      avgConversionRate: g.count > 0 ? g.avgConversionRate / g.count : 0,
      avgBounceRate: g.count > 0 ? g.avgBounceRate / g.count : 0,
    })).sort((a, b) => b.totalSessions - a.totalSessions);
    const pageRecommendations = buildPageRecommendationsArray(pages);
    res.json({ pages, pageGroups, pageRecommendations });
  });

  app.get("/api/boards", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.boards) {
      return res.json({
        boards: null,
        message: "?????????????????????????????",
      });
    }
    res.json({ boards: batch.boards });
  });

  return httpServer;
}
