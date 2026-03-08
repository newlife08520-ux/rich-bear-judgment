import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import multer from "multer";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { loginSchema, settingsSchema, contentJudgmentInputSchema, contentJudgmentChatRequestSchema, META_ACCOUNT_STATUS_MAP, resolveDateRange, buildScopeKey, detectContentType, contentTypeToJudgmentType } from "@shared/schema";
import type { MetaAdAccount, SyncedAccount, CampaignMetrics, GA4FunnelMetrics, AnalysisBatch, DataSourceStatus, DataFlowStatus, ContentJudgmentResult } from "@shared/schema";
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
  buildRealFbOverview, buildRealFbCreatives, buildRealFbDirectorSummary,
  buildRealCampaignStructure, buildRealBudgetRecommendations, buildRealAlerts, buildRealHighRiskItems,
  buildRealGA4FunnelOverview, buildRealGA4FunnelSegments, buildRealGA4DropPoints,
  buildRealGA4PageRanking, buildRealGA4DirectorSummary, buildRealGA4PriorityFixes, buildRealGA4HighRiskItems,
  buildRealGA4Pages, buildTodayVerdict, buildTodayPriorities, buildBusinessOverview,
  buildRealOpportunities, buildPageRecommendationsArray, buildFunnelDrillDown,
} from "./real-data-transformers";
import { assetRouter } from "./modules/asset/asset-routes";
import { assetPackageRouter } from "./modules/asset/asset-package-routes";
import { assetVersionRouter } from "./modules/asset/asset-version-routes";
import { resolveFilePathForRequest, ensureUploadProviderReady } from "./modules/asset/upload-provider";
import { checkFfprobeAvailable } from "./modules/asset/ffprobe-health";
import { publishRouter } from "./modules/publish/publish-routes";
import {
  aggregateByProductWithResolver,
  aggregateByCreativeTagsWithResolver,
  parseCampaignNameToTags,
  getBudgetRecommendation,
  getHistoricalFailureRateByTag,
  type ProductLevelMetrics,
  type CreativeTagLevelMetrics,
} from "@shared/tag-aggregation-engine";
import {
  getWorkbenchOwners,
  patchWorkbenchProductOwner,
  getWorkbenchTasks,
  createWorkbenchTask,
  updateWorkbenchTask,
  batchUpdateWorkbenchTasks,
  getWorkbenchTask,
  getWorkbenchAuditLog,
  getWorkbenchMappingOverrides,
  setWorkbenchMappingOverride,
  getWorkbenchMappingRecord,
  resolveProductWithOverrides,
  getPublishedThresholdConfig,
  getDraftThresholdConfig,
  saveDraftThresholdConfig,
  publishThreshold,
  rollbackThreshold,
  getPublishedPrompt,
  getPublishedPromptWithMeta,
  getDraftPrompt,
  saveDraftPrompt,
  publishPrompt,
  rollbackPrompt,
} from "./workbench-db";
import { getAssembledSystemPrompt, suggestUIModeFromJudgmentType, STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION, type UIMode, type JudgmentType as AssemblyJudgmentType } from "./rich-bear-prompt-assembly";
import { parseStructuredJudgmentFromResponse } from "./parse-structured-judgment";
import { CALIBRATION_MODULE_NAMES } from "./rich-bear-calibration";
import {
  fetchMockGA4DataByProduct,
  stitchFunnelData,
  runFunnelDiagnostics,
} from "@shared/funnel-stitching";
import { buildDecisionCards, type CreativeLeaderboardRow } from "@shared/decision-cards-engine";
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

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const MemoryStore = createMemoryStore(session);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "未登入" });
  }
  next();
}

function getBatchFromRequest(req: Request): AnalysisBatch | null {
  const userId = req.session.userId!;
  const scopeKey = (req.query.scope as string) || undefined;
  return storage.getLatestBatch(userId, scopeKey);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  ensureUploadProviderReady();
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-secret-key-marketing-judge",
      store: new MemoryStore({ checkPeriod: 86400000 }),
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  app.post("/api/auth/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "請輸入有效的帳號與密碼" });
    }
    const user = await storage.getUserByUsername(result.data.username);
    if (!user || user.password !== result.data.password) {
      return res.status(401).json({ message: "帳號或密碼錯誤" });
    }
    req.session.userId = user.id;
    const { password, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "未登入" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "用戶不存在" });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "已登出" });
    });
  });

  /** 存活檢查已改在 server/index.ts 最早註冊，此處不再重複 */

  /** 正式環境驗證：ffprobe 是否可執行；不須登入。失敗時 code: ENOENT=未安裝/PATH、PERM=權限、TIMEOUT=逾時、OTHER */
  app.get("/api/health/ffprobe", (_req, res) => {
    const result = checkFfprobeAvailable();
    res.status(result.ok ? 200 : 503).json(result);
  });

  app.use("/api/assets", requireAuth, assetRouter);
  app.use("/api/asset-packages", requireAuth, assetPackageRouter);
  app.use("/api/asset-versions", requireAuth, assetVersionRouter);
  app.use("/api/publish", requireAuth, publishRouter);

  app.get("/api/uploads/:userId/:filename", requireAuth, (req, res) => {
    const sessionUserId = req.session.userId;
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    if (!userId || !filename) {
      return res.status(404).json({ message: "檔案不存在" });
    }
    if (sessionUserId !== userId) {
      return res.status(403).json({ message: "無權限存取此檔案" });
    }
    let decodedFilename = filename;
    try {
      decodedFilename = decodeURIComponent(filename);
    } catch {
      decodedFilename = filename;
    }
    const filePath = resolveFilePathForRequest(userId, filename);
    const targetPathSimple = path.resolve(process.cwd(), ".data", "uploads", userId, decodedFilename);
    console.log("\n--- [讀取素材 Debug] ---");
    console.log("1. 收到請求 URL:", req.originalUrl);
    console.log("2. 解析出的 userId:", userId, "| filename (decoded):", decodedFilename);
    console.log("3. 後端 resolveFilePathForRequest 回傳路徑:", filePath ?? "(null)");
    console.log("4. 簡化路徑 .data/uploads/userId/filename:", targetPathSimple);
    console.log("5. resolveFilePathForRequest 路徑是否存在 (fs.existsSync)?:", filePath ? fs.existsSync(filePath) : false);
    console.log("6. 簡化路徑是否存在?", fs.existsSync(targetPathSimple));
    console.log("------------------------\n");
    if (!filePath) {
      return res.status(404).json({ message: "檔案不存在" });
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
    const { type, value } = req.body;
    if (!type || !["ga4", "fb", "ai"].includes(type)) {
      return res.status(400).json({ success: false, status: "error", message: "無效的連線類型", errorCode: "INVALID_TYPE", checkedAt: new Date().toISOString() });
    }
    if (!value || !value.trim()) {
      const emptyMessages: Record<string, string> = {
        ai: "尚未輸入 API Key，請先輸入 AI 模型的 API 金鑰",
        fb: "尚未輸入 Access Token，請先輸入 Facebook API 存取權杖",
        ga4: "尚未輸入 Property ID，請先輸入 GA4 資源 ID",
      };
      return res.json({ success: false, status: "error", message: emptyMessages[type] || "欄位不能為空", errorCode: "EMPTY_VALUE", checkedAt: new Date().toISOString() });
    }

    const checkedAt = new Date().toISOString();

    try {
      if (type === "ai") {
        const productionModel = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
        const testModel = "gemini-2.0-flash";
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(value.trim());
          const model = genAI.getGenerativeModel({ model: testModel });
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000));
          const result = await Promise.race([model.generateContent("hi"), timeoutPromise]);
          const text = result.response.text();
          if (text && text.length > 0) {
            return res.json({ success: true, status: "success", message: `API Key 驗證成功，可正常存取 Gemini API。正式審判將使用模型 ${productionModel}`, testedModel: testModel, productionModel, checkedAt });
          } else {
            return res.json({ success: false, status: "error", message: `模型回應為空，請確認 API Key 是否正常`, errorCode: "EMPTY_RESPONSE", testedModel: testModel, productionModel, checkedAt });
          }
        } catch (err: any) {
          const errMsg = err.message || String(err);
          if (errMsg === "TIMEOUT") {
            return res.json({ success: false, status: "error", message: "驗證逾時（超過 15 秒），請稍後再試", errorCode: "TIMEOUT", testedModel: testModel, productionModel, checkedAt });
          }
          if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
            return res.json({ success: false, status: "error", message: "API Key 無效，請確認金鑰是否正確", errorCode: "API_KEY_INVALID", testedModel: testModel, productionModel, checkedAt });
          }
          if (errMsg.includes("not found") || errMsg.includes("is not found")) {
            return res.json({ success: false, status: "error", message: `模型 ${testModel} 不存在，請確認模型名稱是否正確`, errorCode: "MODEL_NOT_FOUND", testedModel: testModel, productionModel, checkedAt });
          }
          if (errMsg.includes("permission") || errMsg.includes("PERMISSION_DENIED")) {
            return res.json({ success: false, status: "error", message: `目前 API Key 沒有 Gemini API 的存取權限`, errorCode: "PERMISSION_DENIED", testedModel: testModel, productionModel, checkedAt });
          }
          if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            return res.json({ success: false, status: "error", message: "API 配額已用完，請稍後再試或升級方案", errorCode: "QUOTA_EXHAUSTED", testedModel: testModel, productionModel, checkedAt });
          }
          if (errMsg.includes("billing") || errMsg.includes("BILLING")) {
            return res.json({ success: false, status: "error", message: "帳戶帳單問題，請確認 Google Cloud 帳單設定", errorCode: "BILLING_ERROR", testedModel: testModel, productionModel, checkedAt });
          }
          return res.json({ success: false, status: "error", message: `AI 連線失敗: ${errMsg.slice(0, 200)}`, errorCode: "AI_ERROR", testedModel: testModel, productionModel, checkedAt });
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
                  topNames: accounts.slice(0, 3).map((a: any) => a.name || a.account_id || "未命名"),
                };
              }
            } catch {}
            const acctMsg = accountPreview
              ? `，可用廣告帳號: ${accountPreview.totalCount} 個${accountPreview.topNames.length > 0 ? ` (${accountPreview.topNames.join("、")}${accountPreview.totalCount > 3 ? "..." : ""})` : ""}`
              : "";
            return res.json({ success: true, status: "success", message: `Facebook 連線成功，帳號: ${name} (ID: ${fbData.id})${acctMsg}`, accountPreview, checkedAt });
          }
          const fbError = fbData.error;
          if (fbError) {
            if (fbError.code === 190) {
              const subcode = fbError.error_subcode;
              if (subcode === 463 || subcode === 467) {
                return res.json({ success: false, status: "error", message: "Facebook Access Token 已過期，請重新取得新的 Token", errorCode: "FB_TOKEN_EXPIRED", checkedAt });
              }
              return res.json({ success: false, status: "error", message: `Facebook Access Token 無效: ${fbError.message}`, errorCode: "FB_TOKEN_INVALID", checkedAt });
            }
            if (fbError.code === 10 || fbError.code === 200) {
              return res.json({ success: false, status: "error", message: `Facebook Token 權限不足: ${fbError.message}`, errorCode: "FB_PERMISSION_DENIED", checkedAt });
            }
            return res.json({ success: false, status: "error", message: `Facebook API 錯誤: ${fbError.message}`, errorCode: "FB_API_ERROR", checkedAt });
          }
          return res.json({ success: false, status: "error", message: "Facebook API 回傳未預期的格式", errorCode: "FB_UNKNOWN", checkedAt });
        } catch (err: any) {
          if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.message?.includes("fetch")) {
            return res.json({ success: false, status: "error", message: "無法連線至 Facebook API，請檢查網路連線", errorCode: "NETWORK_ERROR", checkedAt });
          }
          return res.json({ success: false, status: "error", message: `Facebook 連線失敗: ${(err.message || String(err)).slice(0, 200)}`, errorCode: "FB_ERROR", checkedAt });
        }
      }

      if (type === "ga4") {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) {
          return res.json({ success: false, status: "error", message: "GA4 Property ID 格式錯誤，應為純數字 (例如: 123456789)", errorCode: "GA4_FORMAT_INVALID", checkedAt });
        }
        const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!saKeyJson) {
          return res.json({
            success: false,
            status: "error",
            message: `Property ID ${trimmed} 格式正確，但系統尚未設定 Service Account 憑證。請在環境變數中設定 GOOGLE_SERVICE_ACCOUNT_KEY（完整 JSON 金鑰內容）`,
            errorCode: "GA4_NO_AUTH",
            ga4Detail: { propertyId: trimmed, authConfigured: false },
            checkedAt,
          });
        }
        let credentials: any;
        try {
          credentials = JSON.parse(saKeyJson);
        } catch {
          return res.json({ success: false, status: "error", message: "Service Account 憑證載入失敗，JSON 格式無效。請確認 GOOGLE_SERVICE_ACCOUNT_KEY 的內容是完整的 JSON", errorCode: "GA4_CRED_PARSE_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: false }, checkedAt });
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
            return res.json({ success: false, status: "error", message: "Service Account 憑證有效，但無法取得 Access Token。請確認憑證權限設定", errorCode: "GA4_TOKEN_FAILED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
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
            const activeUsers = ga4Data.rows?.[0]?.metricValues?.[0]?.value || "0";
            return res.json({
              success: true,
              status: "success",
              message: `GA4 Property ${trimmed} 連線成功 (Service Account: ${credentials.client_email})，近期活躍用戶: ${activeUsers}`,
              ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email },
              checkedAt,
            });
          }
          const ga4Error = ga4Data.error;
          if (ga4Error) {
            if (ga4Error.status === "UNAUTHENTICATED" || ga4Error.code === 401) {
              return res.json({ success: false, status: "error", message: "Service Account 授權失敗，憑證可能已過期或被撤銷", errorCode: "GA4_UNAUTHENTICATED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "PERMISSION_DENIED" || ga4Error.code === 403) {
              const msg = (ga4Error.message || "").toLowerCase();
              if (msg.includes("api not enabled") || msg.includes("has not been used") || msg.includes("analyticsdata")) {
                return res.json({ success: false, status: "error", message: `Google Analytics Data API 尚未啟用。請到 Google Cloud Console 啟用 "Google Analytics Data API" (專案: ${credentials.project_id})`, errorCode: "GA4_API_NOT_ENABLED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
              }
              return res.json({ success: false, status: "error", message: `Service Account (${credentials.client_email}) 沒有 GA4 Property ${trimmed} 的讀取權限。請到 GA4 管理介面 > Property Access Management 新增此 Service Account 並授予 Viewer 角色`, errorCode: "GA4_PERMISSION_DENIED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "NOT_FOUND" || ga4Error.code === 404) {
              return res.json({ success: false, status: "error", message: `GA4 Property ID ${trimmed} 不存在，請確認 Property ID 是否正確`, errorCode: "GA4_NOT_FOUND", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "INVALID_ARGUMENT" || ga4Error.code === 400) {
              return res.json({ success: false, status: "error", message: `GA4 API 參數錯誤: ${ga4Error.message}`, errorCode: "GA4_INVALID_ARGUMENT", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            return res.json({ success: false, status: "error", message: `GA4 API 錯誤: ${ga4Error.message || ga4Error.status}`, errorCode: "GA4_API_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
          }
          return res.json({ success: false, status: "error", message: "GA4 API 回傳未預期的格式", errorCode: "GA4_UNKNOWN", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
        } catch (err: any) {
          const errMsg = err.message || String(err);
          if (errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("network")) {
            return res.json({ success: false, status: "error", message: "無法連線至 Google Analytics API，請檢查網路連線", errorCode: "NETWORK_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          if (errMsg.includes("invalid_grant") || errMsg.includes("Invalid JWT")) {
            return res.json({ success: false, status: "error", message: "Service Account 憑證無效或已過期，請重新產生金鑰", errorCode: "GA4_INVALID_CRED", ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          return res.json({ success: false, status: "error", message: `GA4 連線失敗: ${errMsg.slice(0, 200)}`, errorCode: "GA4_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
        }
      }
    } catch (err: any) {
      return res.json({ success: false, status: "error", message: `伺服器錯誤: ${(err.message || String(err)).slice(0, 200)}`, errorCode: "SERVER_ERROR", checkedAt });
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
      return res.status(400).json({ message: "請提供審判內容", errors: result.error.flatten() });
    }

    const userId = req.session.userId!;
    const input = result.data;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey;

    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({
        message: "尚未設定 AI API Key，請先到「設定」頁面輸入 Gemini API Key 才能啟動審判",
        errorCode: "NO_API_KEY",
      });
    }

    const contentType = input.detectedType || detectContentType({
      url: input.url || undefined,
      text: input.text || undefined,
    });
    const judgmentType = contentTypeToJudgmentType(contentType);
    const uiMode = suggestUIModeFromJudgmentType(judgmentType as AssemblyJudgmentType);
    const publishedMain = await getPublishedPrompt(uiMode);
    const systemPrompt = getAssembledSystemPrompt({
      uiMode,
      customMainPrompt: publishedMain,
      judgmentType: judgmentType as AssemblyJudgmentType,
    });
    const userPrompt = buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType);

    console.log(`[ContentJudgment] type=${contentType}, judgmentType=${judgmentType}, uiMode=${uiMode}, purpose=${input.purpose}, depth=${input.depth}`);

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
        message: "AI 分析失敗，請確認 API Key 是否正確，或稍後再試",
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
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 },
  }).single("file");

  app.post("/api/content-judgment/upload-file", requireAuth, contentJudgmentFileUpload, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey?.trim();
    if (!apiKey) {
      return res.status(400).json({ message: "尚未設定 AI API Key", errorCode: "NO_API_KEY" });
    }
    const file = (req as Request & { file?: Express.Multer.File & { buffer?: Buffer } }).file;
    const buffer = file?.buffer ?? (file as any)?.buffer;
    if (!file || !buffer) {
      return res.status(400).json({ message: "請上傳檔案" });
    }
    const mimeType = file.mimetype || "application/octet-stream";
    const name = file.originalname || `upload-${Date.now()}`;
    try {
      const fileManager = new GoogleAIFileManager(apiKey);
      const result = await fileManager.uploadFile(buffer, { mimeType, name });
      const fileUri = result.file.name || result.file.uri;
      if (!fileUri) {
        return res.status(502).json({ message: "File API 未回傳檔案 URI" });
      }
      res.json({ fileUri, mimeType, name: result.file.displayName || name });
    } catch (e: any) {
      console.error("[ContentJudgment] upload-file error:", e?.message || e);
      return res.status(502).json({
        message: e?.message?.includes("quota") ? "檔案上傳配額已用盡" : "檔案上傳失敗，請稍後再試",
        errorCode: "UPLOAD_FAILED",
      });
    }
  });

  app.post("/api/content-judgment/chat", requireAuth, async (req, res) => {
    const parsed = contentJudgmentChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "請提供訊息內容", errors: parsed.error.flatten() });
    }

    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const apiKey = settings.aiApiKey;
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        message: "尚未設定 AI API Key，請先到「設定」頁面輸入 Gemini API Key",
        errorCode: "NO_API_KEY",
      });
    }

    const { sessionId, message, uiMode } = parsed.data;
    // 一律使用 workbench 片段組裝，不讀 storage、不用 draft。未帶 uiMode 時預設 creative。
    const effectiveMode: UIMode = uiMode && ["boss", "buyer", "creative"].includes(uiMode) ? (uiMode as UIMode) : "creative";
    const publishedMain = await getPublishedPrompt(effectiveMode);
    // 未發布時：customMainPrompt 為 null，組裝層會用 Base Core + 內層 A/B/C/D + calibration，絕不吃 draft 或舊 storage。
    const systemPrompt =
      getAssembledSystemPrompt({
        uiMode: effectiveMode,
        customMainPrompt: publishedMain,
      }) + STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION;

    let session = sessionId ? storage.getReviewSession(sessionId) : undefined;
    if (sessionId && !session) {
      return res.status(404).json({ message: "找不到該對話串" });
    }
    if (session && session.userId !== userId) {
      return res.status(403).json({ message: "無權存取此對話" });
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
      const title = message.content.slice(0, 50).trim() || "新判讀";
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
        message: "AI 回覆失敗，請確認 API Key 或稍後再試",
        errorCode: "AI_CALL_FAILED",
      });
    }

    const assistantMsgId = `msg-${randomUUID().slice(0, 8)}`;
    const structuredJudgment = parseStructuredJudgmentFromResponse(assistantText);
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

    res.json({ session, userMessage, assistantMessage });
  });

  app.get("/api/review-sessions", requireAuth, (req, res) => {
    const list = storage.getReviewSessions(req.session.userId!);
    res.json(list);
  });

  app.get("/api/review-sessions/:id", requireAuth, (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = storage.getReviewSession(id);
    if (!session) return res.status(404).json({ message: "找不到該對話串" });
    if (session.userId !== req.session.userId) return res.status(403).json({ message: "無權存取" });
    res.json(session);
  });

  app.get("/api/judgment/history", requireAuth, (req, res) => {
    const records = storage.getJudgmentHistory(req.session.userId!);
    const typeFilter = req.query.type as string | undefined;
    if (typeFilter) {
      res.json(records.filter((r) => r.type === typeFilter));
    } else {
      res.json(records);
    }
  });

  app.get("/api/judgment/:id", requireAuth, (req, res) => {
    const report = storage.getJudgmentReport(req.params.id as string);
    if (!report) {
      return res.status(404).json({ message: "審判紀錄不存在" });
    }
    res.json(report);
  });

  app.get("/api/fb-ads/overview", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json(null);
    res.json(buildRealFbOverview(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/creatives", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const search = req.query.search as string | undefined;
    res.json(buildRealFbCreatives(batch.campaignMetrics, search));
  });

  app.get("/api/fb-ads/director-summary", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) return res.json(null);
    res.json(buildRealFbDirectorSummary(batch.summary));
  });

  app.get("/api/fb-ads/buried-gems", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const creatives = buildRealFbCreatives(batch.campaignMetrics);
    res.json(creatives.filter(c => c.aiLabel === "高潛力未放大"));
  });

  app.get("/api/fb-ads/stop-list", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    const creatives = buildRealFbCreatives(batch.campaignMetrics);
    res.json(creatives.filter(c => ["先停再說", "已疲勞"].includes(c.aiLabel)));
  });

  app.get("/api/fb-ads/campaign-structure", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);

    const adsetData = batch.adsetMetrics;
    const adData = batch.adMetrics;
    const structures = buildRealCampaignStructure(batch.campaignMetrics, adsetData, adData);

    if (!adsetData || adsetData.length === 0) {
      structures.push({
        id: "placeholder-adset-info",
        name: "Ad Set 層資料需要額外 API 權限",
        level: "adset",
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        roas: 0,
        frequency: 0,
        conversions: 0,
        aiLabel: "資訊",
        aiComment: "Ad Set 層資料需要額外 API 權限，請確認 Meta Access Token 具備 ads_read 權限",
        judgmentScore: 0,
        opportunityScore: 0,
        recommendationLevel: "ignore",
      });
    }

    res.json(structures);
  });

  app.get("/api/fb-ads/budget-recommendations", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealBudgetRecommendations(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/alerts", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealAlerts(batch.campaignMetrics));
  });

  app.get("/api/fb-ads/high-risk", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || batch.campaignMetrics.length === 0) return res.json([]);
    res.json(buildRealHighRiskItems(batch.campaignMetrics));
  });

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
        ? "尚未設定 Facebook Access Token"
        : metaAccounts.length === 0
          ? "已設定 Token，尚未同步帳號"
          : metaSelected.length === 0
            ? `已同步 ${metaAccounts.length} 個帳號，尚未選擇分析帳號`
            : `已選擇 ${metaSelected.length} 個帳號進行分析`,
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
        ? "尚未設定 GA4 Property ID"
        : ga4Accounts.length === 0
          ? "已設定 Property ID，尚未同步資源"
          : ga4Selected.length === 0
            ? `已同步 ${ga4Accounts.length} 個資源，尚未選擇分析資源`
            : `已選擇 ${ga4Selected.length} 個資源進行分析`,
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
        lastBatchScope: batch ? buildScopeKey(userId, batch.selectedAccountIds || [], batch.selectedPropertyIds || [], batch.dateRange.preset) : null,
        isStale: batch ? (Date.now() - new Date(batch.generatedAt).getTime()) > 24 * 60 * 60 * 1000 : true,
      },
      dataCoverage,
    };

    res.json(status);
  });

  app.get("/api/fb-ads/meta-accounts", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const token = settings.fbAccessToken?.trim();
    if (!token) {
      return res.json({ accounts: [], totalCount: 0, message: "尚未設定 Facebook Access Token，請先在系統設定中輸入" });
    }
    try {
      const acctRes = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(token)}`
      );
      const acctData = await acctRes.json();
      if (!acctRes.ok || !acctData.data) {
        const errMsg = acctData.error?.message || "未知錯誤";
        if (acctData.error?.code === 190) {
          return res.json({ accounts: [], totalCount: 0, message: "Facebook Access Token 已過期或無效，請重新取得" });
        }
        return res.json({ accounts: [], totalCount: 0, message: `無法取得廣告帳號: ${errMsg}` });
      }
      const favorites = storage.getFbFavoriteAccounts(userId);
      const favSet = new Set(favorites);
      const accounts: MetaAdAccount[] = (acctData.data as any[]).map((a: any) => ({
        accountId: a.account_id || a.id?.replace("act_", "") || "",
        name: a.name || "未命名帳號",
        accountStatus: a.account_status || 0,
        accountStatusLabel: META_ACCOUNT_STATUS_MAP[a.account_status] || "未知",
        currency: a.currency || "USD",
        timezoneName: a.timezone_name || "",
        isFavorite: favSet.has(a.account_id || a.id?.replace("act_", "") || ""),
      }));
      const msg = accounts.length > 0
        ? `已取得 ${accounts.length} 個廣告帳號`
        : "Token 有效但無廣告帳號存取權，請確認 Token 的廣告帳號權限";
      return res.json({ accounts, totalCount: accounts.length, message: msg });
    } catch (err: any) {
      return res.json({ accounts: [], totalCount: 0, message: `無法連線至 Meta API: ${(err.message || "").slice(0, 200)}` });
    }
  });

  app.get("/api/fb-ads/favorite-accounts", requireAuth, (req, res) => {
    const favorites = storage.getFbFavoriteAccounts(req.session.userId!);
    res.json({ favorites });
  });

  app.post("/api/fb-ads/favorite-accounts", requireAuth, (req, res) => {
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds)) {
      return res.status(400).json({ message: "accountIds 必須是陣列" });
    }
    const saved = storage.saveFbFavoriteAccounts(req.session.userId!, accountIds);
    res.json({ favorites: saved });
  });

  app.get("/api/settings", requireAuth, (req, res) => {
    const settings = storage.getSettings(req.session.userId!);
    res.json(settings);
  });

  app.put("/api/settings", requireAuth, (req, res) => {
    const result = settingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "設定資料格式有誤" });
    }
    const settings = storage.saveSettings(req.session.userId!, result.data);
    res.json(settings);
  });

  app.post("/api/accounts/sync", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);

    const results = [];
    let allSyncedAccounts: SyncedAccount[] = [];

    if (settings.fbAccessToken?.trim()) {
      const metaResult = await syncMetaAccounts(settings.fbAccessToken, userId);
      results.push({ platform: metaResult.platform, success: metaResult.success, accountsSynced: metaResult.accountsSynced, message: metaResult.message, syncedAt: metaResult.syncedAt });

      if (metaResult.success && metaResult.accounts.length > 0) {
        allSyncedAccounts.push(...metaResult.accounts);
      }
    }

    if (settings.ga4PropertyId?.trim()) {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const ga4Result = await syncGA4Properties(serviceAccountKey || "", settings.ga4PropertyId, userId);
      results.push(ga4Result);

      if (ga4Result.success) {
        allSyncedAccounts.push({
          id: `ga4-${settings.ga4PropertyId.trim()}`,
          userId,
          platform: "ga4",
          accountId: settings.ga4PropertyId.trim(),
          accountName: `GA4 Property ${settings.ga4PropertyId.trim()}`,
          status: "active",
          lastSyncedAt: new Date().toISOString(),
          isDefault: true,
        });
      }
    }

    if (allSyncedAccounts.length > 0) {
      storage.saveSyncedAccounts(userId, allSyncedAccounts);
    }

    if (results.length === 0) {
      return res.json({ results: [], message: "未設定任何平台連線，請先在設定中綁定 Facebook 或 GA4" });
    }

    res.json({ results, syncedAccounts: storage.getSyncedAccounts(userId) });
  });

  app.get("/api/accounts/synced", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const accounts = storage.getSyncedAccounts(userId);
    res.json({ accounts });
  });

  /** GET /api/meta/pages - 取得使用者 Facebook 粉專與 IG 帳號（供投放中心粉專/IG 下拉） */
  app.get("/api/meta/pages", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const token = settings.fbAccessToken?.trim();
    if (!token) {
      return res.json({ pages: [], igAccounts: [] });
    }
    try {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      );
      const pagesData = await pagesRes.json();
      if (!pagesRes.ok) {
        return res.status(400).json({ message: (pagesData as { error?: { message?: string } }).error?.message || "Meta API 錯誤" });
      }
      const rawPages = (pagesData as { data?: any[] }).data || [];
      const pages: { id: string; name: string }[] = rawPages.map((p: any) => ({ id: p.id, name: p.name || p.id }));
      const igAccounts: { id: string; username: string; pageId: string }[] = [];
      for (const p of rawPages) {
        const ig = p.instagram_business_account;
        if (ig?.id) {
          igAccounts.push({ id: ig.id, username: ig.username || ig.id, pageId: p.id });
        }
      }
      return res.json({ pages, igAccounts });
    } catch (err: any) {
      return res.status(500).json({ message: `Meta API 連線失敗: ${(err.message || "").slice(0, 200)}` });
    }
  });

  app.post("/api/accounts/sync-selected", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const { platform, accountIds } = req.body;
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ message: "accountIds 必須是非空陣列" });
    }

    const settings = storage.getSettings(userId);
    const existing = storage.getSyncedAccounts(userId);

    if (platform === "meta") {
      const token = settings.fbAccessToken?.trim();
      if (!token) {
        return res.status(400).json({ message: "尚未設定 Facebook Access Token" });
      }
      try {
        const acctRes = await fetch(
          `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(token)}`
        );
        const acctData = await acctRes.json();
        if (!acctRes.ok || !acctData.data) {
          return res.status(400).json({ message: acctData.error?.message || "Meta API 錯誤" });
        }
        const selectedSet = new Set(accountIds);
        const now = new Date().toISOString();
        const newMeta: SyncedAccount[] = (acctData.data as any[])
          .filter((a: any) => selectedSet.has(a.account_id || a.id?.replace("act_", "") || ""))
          .map((a: any, idx: number) => ({
            id: `meta-${a.account_id || a.id?.replace("act_", "")}`,
            userId,
            platform: "meta" as const,
            accountId: a.account_id || a.id?.replace("act_", "") || "",
            accountName: a.name || "未命名帳號",
            status: a.account_status === 1 ? "active" as const : "disconnected" as const,
            lastSyncedAt: now,
            isDefault: idx === 0,
            currency: a.currency || "USD",
            timezoneName: a.timezone_name || "",
            metaAccountStatus: a.account_status,
          }));

        const nonMeta = existing.filter(a => a.platform !== "meta");
        const merged = [...nonMeta, ...newMeta];
        storage.saveSyncedAccounts(userId, merged);
        console.log(`[SyncSelected] Synced ${newMeta.length} Meta accounts for user=${userId}`);
        return res.json({ success: true, syncedCount: newMeta.length, accounts: merged });
      } catch (err: any) {
        return res.status(500).json({ message: `Meta API 連線失敗: ${(err.message || "").slice(0, 200)}` });
      }
    }

    if (platform === "ga4") {
      const now = new Date().toISOString();
      const nonGA4 = existing.filter(a => a.platform !== "ga4");
      const newGA4: SyncedAccount[] = accountIds.map((propId: string, idx: number) => ({
        id: `ga4-${propId}`,
        userId,
        platform: "ga4" as const,
        accountId: propId,
        accountName: `GA4 Property ${propId}`,
        status: "active" as const,
        lastSyncedAt: now,
        isDefault: idx === 0,
      }));
      const merged = [...nonGA4, ...newGA4];
      storage.saveSyncedAccounts(userId, merged);
      console.log(`[SyncSelected] Synced ${newGA4.length} GA4 properties for user=${userId}`);
      return res.json({ success: true, syncedCount: newGA4.length, accounts: merged });
    }

    return res.status(400).json({ message: `不支援的平台: ${platform}` });
  });

  app.post("/api/refresh", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const settings = storage.getSettings(userId);
    const datePreset = (req.body.datePreset as string) || "7";
    const customStart = req.body.customStart as string | undefined;
    const customEnd = req.body.customEnd as string | undefined;
    const selectedAccountIds: string[] = req.body.selectedAccountIds || [];
    const selectedPropertyIds: string[] = req.body.selectedPropertyIds || [];
    const dateRange = resolveDateRange(datePreset, customStart, customEnd);

    const currentStatus = storage.getRefreshStatus(userId);
    if (currentStatus?.isRefreshing) {
      return res.json({ success: true, message: "資料更新中，請稍候", alreadyRunning: true });
    }

    storage.setRefreshStatus(userId, {
      isRefreshing: true,
      currentStep: "開始更新...",
      progress: 5,
    });

    res.json({ success: true, message: "資料更新已啟動", started: true });

    (async () => {
    try {
      storage.setRefreshStatus(userId, { currentStep: "同步帳號...", progress: 10 });
      let syncedAccounts = storage.getSyncedAccounts(userId);

      if (selectedAccountIds.length > 0) {
        const syncedMetaIds = new Set(syncedAccounts.filter(a => a.platform === "meta").map(a => a.accountId));
        const missingIds = selectedAccountIds.filter(id => !syncedMetaIds.has(id));
        if (missingIds.length > 0 && settings.fbAccessToken?.trim()) {
          try {
            const acctRes = await fetch(
              `https://graph.facebook.com/v19.0/me/adaccounts?fields=account_id,name,account_status,currency,timezone_name&limit=500&access_token=${encodeURIComponent(settings.fbAccessToken.trim())}`
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
                  status: a.account_status === 1 ? "active" as const : "disconnected" as const,
                  lastSyncedAt: now,
                  isDefault: false,
                  currency: a.currency || "USD",
                  timezoneName: a.timezone_name || "",
                  metaAccountStatus: a.account_status,
                }));
              if (newAccounts.length > 0) {
                syncedAccounts = [...syncedAccounts, ...newAccounts];
                storage.saveSyncedAccounts(userId, syncedAccounts);
                console.log(`[Refresh] Auto-synced ${newAccounts.length} missing Meta accounts`);
              }
            }
          } catch (e) {
            console.warn("[Refresh] Auto-sync Meta accounts failed:", e);
          }
        }
      }

      let metaAccounts = syncedAccounts.filter(a => a.platform === "meta" && a.status === "active");
      let ga4Accounts = syncedAccounts.filter(a => a.platform === "ga4" && a.status === "active");

      if (selectedAccountIds.length > 0) {
        metaAccounts = metaAccounts.filter(a => selectedAccountIds.includes(a.accountId));
      }
      if (selectedPropertyIds.length > 0) {
        ga4Accounts = ga4Accounts.filter(a => selectedPropertyIds.includes(a.accountId));
      }

      storage.setRefreshStatus(userId, { currentStep: "擷取 Meta 與 GA4 數據...", progress: 20 });

      const [metaResults, ga4Results] = await Promise.all([
        (async () => {
          if (!settings.fbAccessToken?.trim() || metaAccounts.length === 0) return [];
          const fetches = metaAccounts.map(account =>
            fetchMetaCampaignData(
              settings.fbAccessToken,
              account.accountId,
              account.accountName,
              datePreset,
              customStart,
              customEnd
            )
          );
          const results = await Promise.all(fetches);
          return results.flat();
        })(),
        (async () => {
          const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
          if (!serviceAccountKey || ga4Accounts.length === 0) return [];
          const fetches = ga4Accounts.map(account =>
            fetchGA4FunnelData(
              serviceAccountKey,
              account.accountId,
              account.accountName,
              datePreset,
              customStart,
              customEnd
            )
          );
          const results = await Promise.all(fetches);
          return results.filter((m): m is GA4FunnelMetrics => m !== null);
        })(),
      ]);

      let allCampaignMetrics = metaResults;
      const allGA4Metrics = ga4Results;

      storage.setRefreshStatus(userId, { currentStep: "擷取多時間窗口數據...", progress: 40 });

      const accountGroupsForMW = new Map<string, CampaignMetrics[]>();
      for (const c of allCampaignMetrics) {
        if (!accountGroupsForMW.has(c.accountId)) accountGroupsForMW.set(c.accountId, []);
        accountGroupsForMW.get(c.accountId)!.push(c);
      }
      if (settings.fbAccessToken?.trim()) {
        const mwFetches = Array.from(accountGroupsForMW.entries()).map(([actId, camps]) =>
          fetchMultiWindowMetrics(settings.fbAccessToken, actId, camps)
        );
        const mwResults = await Promise.all(mwFetches);
        for (const mwMap of mwResults) {
          for (const c of allCampaignMetrics) {
            const mw = mwMap.get(c.campaignId);
            if (mw) c.multiWindow = mw;
          }
        }
      }

      storage.setRefreshStatus(userId, { currentStep: "擷取 GA4 頁面數據...", progress: 50 });

      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      let allGA4PageMetrics: any[] = [];
      if (serviceAccountKey && ga4Accounts.length > 0) {
        const pageFetches = ga4Accounts.map(account =>
          fetchGA4PageData(serviceAccountKey, account.accountId, datePreset, customStart, customEnd)
        );
        const pageResults = await Promise.all(pageFetches);
        allGA4PageMetrics = pageResults.flat();
      }

      storage.setRefreshStatus(userId, { currentStep: "計算三維評分與風險分析...", progress: 60 });

      const globalAvg = computeAccountAvg(allCampaignMetrics);
      console.log(`[Scoring] Starting scoring for ${allCampaignMetrics.length} campaigns, globalAvg ROAS=${globalAvg.roas.toFixed(2)}`);
      let scoredCount = 0;
      for (const c of allCampaignMetrics) {
        const acctCampaigns = accountGroupsForMW.get(c.accountId) || allCampaignMetrics;
        const acctAvg = computeAccountAvg(acctCampaigns);
        c.triScore = calculateCampaignTriScore(c, acctAvg);
        c.riskLevel = classifyRiskLevel(c.triScore, c, acctAvg);
        c.stopLoss = evaluateStopLoss(c, acctAvg, acctCampaigns);
        c.scoring = buildCampaignScoringResult(c, acctAvg, c.triScore, c.riskLevel, c.stopLoss);
        scoredCount++;
      }
      console.log(`[Scoring] Completed: ${scoredCount}/${allCampaignMetrics.length} campaigns scored. Sample triScore=${JSON.stringify(allCampaignMetrics[0]?.triScore)}, riskLevel=${allCampaignMetrics[0]?.riskLevel}, stopLoss=${!!allCampaignMetrics[0]?.stopLoss}, multiWindow=${!!allCampaignMetrics[0]?.multiWindow}`);

      storage.setRefreshStatus(userId, { currentStep: "執行異常檢測與分析...", progress: 65 });

      const allAnomalies: any[] = [];
      const accountHealthScores: any[] = [];

      const accountGroups = new Map<string, CampaignMetrics[]>();
      for (const c of allCampaignMetrics) {
        if (!accountGroups.has(c.accountId)) accountGroups.set(c.accountId, []);
        accountGroups.get(c.accountId)!.push(c);
      }

      for (const [accountId, campaigns] of Array.from(accountGroups.entries())) {
        const accountName = campaigns[0]?.accountName || accountId;
        const anomalies = detectCampaignAnomalies(campaigns, accountName);
        allAnomalies.push(...anomalies);

        const health = calculateAccountHealth(
          accountId,
          accountName,
          "meta",
          campaigns,
          anomalies,
          allCampaignMetrics,
          null
        );

        const acctAvg = computeAccountAvg(campaigns);
        const acctTriScore = calculateAccountTriScore(campaigns, anomalies, acctAvg);
        health.triScore = acctTriScore;
        health.riskLevel = acctTriScore.health < 30 && acctTriScore.urgency >= 50 ? "danger" as const
          : acctTriScore.health < 50 ? "warning" as const
          : acctTriScore.scalePotential >= 60 ? "potential" as const
          : "stable" as const;

        health.priorityScore = acctTriScore.urgency;
        health.healthStatus = health.riskLevel === "danger" ? "danger"
          : health.riskLevel === "warning" ? "warning"
          : "healthy";

        accountHealthScores.push(health);
      }

      for (const ga4 of allGA4Metrics) {
        const ga4Anomalies = detectGA4Anomalies(ga4, ga4.propertyName);
        allAnomalies.push(...ga4Anomalies);

        const existing = accountHealthScores.find((h: any) => h.accountId === ga4.propertyId);
        if (!existing) {
          const health = calculateAccountHealth(
            ga4.propertyId,
            ga4.propertyName,
            "ga4",
            [],
            ga4Anomalies,
            allCampaignMetrics,
            ga4
          );
          accountHealthScores.push(health);
        }
      }

      storage.setRefreshStatus(userId, { currentStep: "識別機會與風險...", progress: 70 });

      const riskyCampaigns = identifyRiskyCampaigns(allCampaignMetrics);
      const scaleOpportunities = riskyCampaigns.filter(r => r.riskType === "low_spend_high_potential");
      const realRisks = riskyCampaigns.filter(r => r.riskType !== "low_spend_high_potential");

      const riskyCampaignIds = new Set(realRisks.map(r => r.campaignId));
      const opportunities = classifyOpportunities(allCampaignMetrics, globalAvg, riskyCampaignIds);
      console.log(`[Scoring] Opportunities: ${opportunities.length}, GA4PageMetrics: ${allGA4PageMetrics.length}, RiskyCampaigns: ${riskyCampaigns.length}`);

      storage.setRefreshStatus(userId, { currentStep: "計算 V2 評分與戰情板...", progress: 72 });

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
        console.log(`[Scoring] V2 page scoring completed for ${allGA4PageMetrics.length} pages`);
      }

      for (const acctHealth of accountHealthScores) {
        const acctCampaigns = accountGroups.get(acctHealth.accountId) || [];
        const acctAnomalies = allAnomalies.filter((a: any) => a.accountId === acctHealth.accountId);
        const acctAvg = computeAccountAvg(acctCampaigns);
        const acctTriScore = acctHealth.triScore || { health: 50, urgency: 0, scalePotential: 30 };
        const acctRiskLevel = acctHealth.riskLevel || "stable";
        acctHealth.scoring = buildAccountScoringResult(acctTriScore, acctRiskLevel, acctCampaigns, acctAnomalies, acctAvg);
      }
      console.log(`[Scoring] V2 account scoring completed for ${accountHealthScores.length} accounts`);

      const boards = buildBoardSet(allCampaignMetrics, allGA4PageMetrics, accountHealthScores);
      console.log(`[Scoring] Board engine: danger=${boards.dangerBoard.length}, stopLoss=${boards.stopLossBoard.length}, opportunity=${boards.opportunityBoard.length}, scale=${boards.scaleBoard.length}, priority=${boards.priorityBoard.length}, leakage=${boards.leakageBoard.length}`);

      storage.setRefreshStatus(userId, { currentStep: "產生 AI 策略摘要...", progress: 80 });

      const geminiApiKey = settings.aiApiKey || "";

      const summary = await generateCrossAccountSummary(geminiApiKey, {
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
      console.log(`[Scoring] Pre-save verification: batch.campaignMetrics[0].triScore=${JSON.stringify(batch.campaignMetrics[0]?.triScore)}, riskLevel=${batch.campaignMetrics[0]?.riskLevel}, stopLoss=${!!batch.campaignMetrics[0]?.stopLoss}, multiWindow=${!!batch.campaignMetrics[0]?.multiWindow}`);
      storage.saveBatch(userId, batch);

      const now = new Date().toISOString();
      storage.setRefreshStatus(userId, {
        isRefreshing: false,
        currentStep: "完成",
        progress: 100,
        lastRefreshedAt: now,
        lastAnalysisAt: now,
        lastAiSummaryAt: summary.aiLastGeneratedAt,
      });

      console.log(`[Refresh] Pipeline completed: batch=${batch.batchId}, ${allCampaignMetrics.length} campaigns, ${allGA4Metrics.length} GA4 properties, ${allAnomalies.length} anomalies`);
    } catch (err: any) {
      console.error("[Refresh] Pipeline error:", err);
      storage.setRefreshStatus(userId, {
        isRefreshing: false,
        currentStep: `失敗: ${(err.message || "").slice(0, 100)}`,
        progress: 0,
      });
    }
    })();
  });

  app.get("/api/refresh/status", requireAuth, (req, res) => {
    const status = storage.getRefreshStatus(req.session.userId!);
    res.json(status);
  });

  app.get("/api/dashboard/cross-account-summary", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary) {
      return res.json({
        hasSummary: false,
        message: "尚未執行數據分析，請先點擊「更新資料」按鈕",
      });
    }
    res.json({ hasSummary: true, summary: batch.summary });
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

  /** P3-3 素材/新品生命週期看板：ROI-first + Funnel Health + Confidence；回傳 label / qualityScore / confidenceLevel / evidence */
  app.get("/api/dashboard/creative-lifecycle", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const labelFilter = typeof req.query.label === "string" ? req.query.label : undefined;
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ items: [], success: [], underfunded: [], retired: [] });
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
    }> = [];

    for (const { row, productName } of pairs) {
      const { baseline, scope } = getBaselineFor(productName, row.accountId, baselineResult);
      const result = computeRoiFunnel(row, baseline, thresholds, { baselineScope: scope });
      const action = getSuggestedAction(result.label, result.evidence, thresholds);
      const reason = [result.evidence.funnelPass ? "漏斗健康" : "漏斗未達標", result.evidence.gateClicks ? "clicks 達門檻" : "clicks 不足", action].filter(Boolean).join("；");
      const impactTwd = row.revenue || row.spend;
      const priority = impactTwd * confidenceMultiplier(result.confidenceLevel) * (result.qualityScore / 100);

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
      };
      if (labelFilter && result.label !== labelFilter) continue;
      items.push(item);

      if (result.label === "Winner") success.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
      else if (result.label === "Underfunded") underfunded.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
      else if (result.label === "Lucky" || result.label === "FunnelWeak" || result.label === "Retired") retired.push({ id: item.id, name: item.name, roas: item.roas, spend: item.spend, reason: item.reason });
    }

    items.sort((a, b) => b.priority - a.priority);
    res.json({ items, success, underfunded, retired });
  });

  /** P4-1 新品/素材成功率成績單：按人、按商品；含 luckyRate、funnelPassRate、avgQualityScore */
  app.get("/api/dashboard/scorecard", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const groupBy = (req.query.groupBy as string) === "person" ? "person" : "product";
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ items: [], groupBy });
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
      const buyerId = o?.productOwnerId?.trim() || "未指派";
      const creativeId = (o?.creativeOwnerId?.trim() || o?.mediaOwnerId?.trim()) || "未指派";
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

  /** P4-2 汰換建議：priority = impactTwd * confidenceMultiplier * (qualityScore/100)；Lucky/Underfunded 明確 action */
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
          suggestion: "加碼建議",
          action: "逐步提高預算 20–30%（漏斗健康且 ROAS 達標）",
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
          suggestion: "運氣單勿加碼",
          action: "補量到門檻再判（達 minClicks/minPurchases/minSpend 後再評估）",
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
          suggestion: result.label === "Retired" ? "淘汰建議" : "補素材建議",
          action: result.label === "Retired" ? "暫停或更換素材" : "優化落地頁/受眾，提升 ATC 與購買率",
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

  /** Lucky 一鍵生成「補量到門檻」任務；完成後於下次資料刷新時會自動重新分類 */
  app.post("/api/dashboard/lucky-tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ created: [], count: 0, message: "無批次資料" });
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
      const action = `補量到門檻（達 ${thresholds.minClicks} clicks、${thresholds.minPurchases} 次購買、spend ≥ ${thresholds.minSpend} 後再評估）`;
      const reason = getSuggestedAction("Lucky", result.evidence, thresholds);
      luckyItems.push({ productName, campaignName: row.campaignName, action, reason });
    }
    const created: Awaited<ReturnType<typeof createWorkbenchTask>>[] = [];
    for (const it of luckyItems) {
      const task = await createWorkbenchTask({
        productName: it.productName ?? undefined,
        title: `[Lucky] ${it.productName ?? "素材"}：${it.campaignName} 補量到門檻`,
        action: it.action,
        reason: it.reason + "；完成後於下次資料刷新時將自動重新分類。",
        assigneeId: null,
        status: "unassigned",
        createdBy: userId,
        notes: "",
      });
      created.push(task);
    }
    res.status(201).json({ created, count: created.length, message: "完成後於下次資料刷新時會自動重新分類" });
  });

  app.post("/api/workbench/tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { items: Array<{ title: string; action: string; reason: string; productName?: string }> };
    if (!Array.isArray(body?.items) || body.items.length === 0) {
      return res.status(400).json({ message: "items 必須為非空陣列" });
    }
    const created: Awaited<ReturnType<typeof createWorkbenchTask>>[] = [];
    for (const it of body.items) {
      if (!it.title || !it.action || !it.reason) continue;
      const task = await createWorkbenchTask({
        productName: it.productName,
        title: it.title,
        action: it.action,
        reason: it.reason,
        assigneeId: null,
        status: "unassigned",
        createdBy: userId,
        notes: "",
      });
      created.push(task);
    }
    res.status(201).json({ created, count: created.length });
  });

  /** P4-3 資料可信度：每商品 unmappedSpend、conflictCount、overrideHitRate → data_confidence 高/中/低 */
  app.get("/api/dashboard/data-confidence", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics?.length) {
      return res.json({ products: [], batchUnmappedSpend: 0 });
    }
    const overrides = await getWorkbenchMappingOverrides();
    const rows = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      accountId: c.accountId,
      spend: c.spend,
    }));
    let batchUnmappedSpend = 0;
    const productSpendFromOverride = new Map<string, number>();
    const productSpendTotal = new Map<string, number>();
    const parseProduct = (name: string) => parseCampaignNameToTags(name)?.productName ?? null;
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
    res.json({ products, batchUnmappedSpend });
  });

  /** P3-1 帳號例外提醒：只回傳「有異常」的帳號與其 anomalies，不回到帳號海；支援 scopeAccountIds 過濾 */
  app.get("/api/dashboard/account-exceptions", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.summary || !batch.summary.anomalies?.length) {
      return res.json({ accounts: [] });
    }
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? new Set(req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean))
      : null;
    let list = batch.summary.anomalies as Array<{ accountId: string; accountName: string; [k: string]: unknown }>;
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

  /** 個人專屬行動中心：雙重過濾（帳號 → 商品）後聚合；P2 使用 mapping overrides（single source of truth） */
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
      return res.json({
        productLevel: [],
        creativeLeaderboard: [],
        hiddenGems: [],
        urgentStop: [],
        riskyCampaigns: [],
        failureRatesByTag: {},
      });
    }

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
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(
        row,
        overrides,
        (name) => parseCampaignNameToTags(name)?.productName ?? null
      );

    const productLevel: ProductLevelMetrics[] = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const creativeRaw: CreativeTagLevelMetrics[] = aggregateByCreativeTagsWithResolver(rows, resolveProduct, scopeProducts);
    const seedHash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
      return Math.abs(h);
    };
    const creativeLeaderboard = creativeRaw.map((c) => {
      const seed = seedHash(`${c.productName}-${c.materialStrategy}-${c.headlineSnippet}`);
      const thumbnailUrl = `https://picsum.photos/seed/${seed}/120/90`;
      const budgetSuggestion = getBudgetRecommendation(c.spend, c.roas) ?? undefined;
      return { ...c, thumbnailUrl, budgetSuggestion };
    });
    const failureRatesByTag = getHistoricalFailureRateByTag(rows);

    const totalSpend = productLevel.reduce((s, p) => s + p.spend, 0);
    const totalRevenue = productLevel.reduce((s, p) => s + p.revenue, 0);
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
      message: `ROAS ${p.roas.toFixed(2)} 高於平均，預算相對低估，建議擴量`,
    }));

    const urgentStop = rows.filter(
      (r: { spend: number; conversions: number }) => r.spend >= 500 && r.conversions === 0
    ).map((r: { campaignId: string; campaignName: string; accountId: string; spend: number }) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      accountId: r.accountId,
      spend: r.spend,
      message: "高花費無轉換，建議止血",
    }));

    let riskyCampaigns: Array<{ campaignId: string; campaignName: string; accountId: string; spend: number; revenue: number; suggestion: string }> = [];
    if (batch.riskyCampaigns && batch.riskyCampaigns.length > 0) {
      const filteredIds = new Set(rows.map((r: { campaignId: string }) => r.campaignId));
      riskyCampaigns = batch.riskyCampaigns
        .filter((r) => filteredIds.has(r.campaignId))
        .map((r) => ({
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          accountId: r.accountId,
          spend: r.spend,
          revenue: r.revenue,
          suggestion: r.suggestion === "stop" ? "建議關閉" : r.suggestion === "observe" ? "觀察" : "可擴量",
        }));
    }

    const productNames = productLevel.map((p) => p.productName);
    const ga4Mock = fetchMockGA4DataByProduct(productNames);
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
    const funnelRows = stitchFunnelData(fbRows, ga4Mock);
    const funnelWarnings = runFunnelDiagnostics(funnelRows);

    res.json({
      productLevel,
      creativeLeaderboard,
      hiddenGems,
      urgentStop,
      riskyCampaigns,
      funnelWarnings,
      failureRatesByTag,
    });
  });

  /** P1/P2 決策卡：由規則引擎產出 8 張卡；P2 使用 mapping overrides */
  app.get("/api/workbench/decision-cards", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const scopeAccountIds = typeof req.query.scopeAccountIds === "string"
      ? req.query.scopeAccountIds.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const scopeProducts = typeof req.query.scopeProducts === "string"
      ? req.query.scopeProducts.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const useOverrides = req.query.useOverrides !== "false";

    if (!batch || !batch.campaignMetrics || batch.campaignMetrics.length === 0) {
      return res.json({ cards: [] });
    }

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
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(
        row,
        overrides,
        (name) => parseCampaignNameToTags(name)?.productName ?? null
      );

    const productLevel = aggregateByProductWithResolver(rows, resolveProduct, scopeProducts);
    const creativeRaw = aggregateByCreativeTagsWithResolver(rows, resolveProduct, scopeProducts);
    const creativeLeaderboard: CreativeLeaderboardRow[] = creativeRaw.map((c) => ({
      productName: c.productName,
      materialStrategy: c.materialStrategy,
      headlineSnippet: c.headlineSnippet,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      conversions: c.conversions,
      campaignCount: c.campaignCount,
    }));
    const failureRatesByTag = getHistoricalFailureRateByTag(rows);

    const urgentStop = rows.filter(
      (r: { spend: number; conversions: number }) => r.spend >= 500 && r.conversions === 0
    ).map((r: { campaignId: string; campaignName: string; accountId: string; spend: number }) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      accountId: r.accountId,
      spend: r.spend,
      message: "高花費無轉換，建議止血",
    }));

    const productNames = productLevel.map((p) => p.productName);
    const ga4Mock = fetchMockGA4DataByProduct(productNames);
    const fbRows = productLevel.map((p) => ({
      productName: p.productName,
      spend: p.spend,
      revenue: p.revenue,
      roas: p.roas,
      impressions: p.impressions,
      clicks: p.clicks,
      conversions: p.conversions,
    }));
    const funnelRows = stitchFunnelData(fbRows, ga4Mock);
    const funnelWarnings = runFunnelDiagnostics(funnelRows);

    const thresholdConfig = await getPublishedThresholdConfig();
    const cards = buildDecisionCards(
      {
        productLevel,
        creativeLeaderboard,
        funnelWarnings: funnelWarnings || [],
        urgentStop,
        failureRatesByTag,
      },
      thresholdConfig as import("@shared/decision-cards-engine").ThresholdConfig | null
    );
    res.json({ cards });
  });

  /** 一鍵 AI 總監驗屍（Mock：依傳入數據回傳固定格式短評） */
  app.post("/api/dashboard/audit-creative", requireAuth, (req, res) => {
    const body = req.body as { thumbnailUrl?: string; roas?: number; spend?: number; productName?: string; materialStrategy?: string; headlineSnippet?: string };
    const roas = typeof body.roas === "number" ? body.roas : 0.5;
    const spend = typeof body.spend === "number" ? body.spend : 5000;
    const productName = body.productName ?? "該商品";
    const materialStrategy = body.materialStrategy ?? "素材";
    const headlineSnippet = body.headlineSnippet ?? "文案";
    const verdict = `AI 總監判讀：花費 ${spend.toLocaleString()} 但 ROAS 僅 ${roas.toFixed(2)}。前三秒缺乏痛點，畫面太唯美無成交感。建議設計師將產品特寫提前 2 秒，行銷替換為「終結噁心感」文案。`;
    res.json({ verdict });
  });

  /** 從近期 Campaign 命名 + mapping overrides 彙總商品名稱列表 */
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

  app.get("/api/fb-ads/opportunities", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.opportunities || batch.opportunities.length === 0) {
      return res.json({ opportunities: [] });
    }
    res.json({ opportunities: batch.opportunities });
  });

  app.get("/api/fb-ads/campaigns-scored", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.campaignMetrics || batch.campaignMetrics.length === 0) {
      return res.json({ campaigns: [] });
    }
    res.json({ campaigns: batch.campaignMetrics });
  });

  app.get("/api/boards", requireAuth, (req, res) => {
    const batch = getBatchFromRequest(req);
    if (!batch || !batch.boards) {
      return res.json({
        boards: null,
        message: "尚未產生戰情板，請先執行數據分析",
      });
    }
    res.json({ boards: batch.boards });
  });

  // ---------- P2 Workbench: Owner / Task / Audit 持久化（SQLite） ----------
  app.get("/api/workbench/owners", requireAuth, async (_req, res) => {
    const data = await getWorkbenchOwners();
    res.json(data);
  });

  app.patch("/api/workbench/owners/:productName", requireAuth, async (req, res) => {
    const productName = decodeURIComponent(req.params.productName || "");
    if (!productName) return res.status(400).json({ message: "缺少 productName" });
    const userId = req.session.userId!;
    const body = req.body as { productOwnerId?: string; mediaOwnerId?: string; creativeOwnerId?: string; taskStatus?: string };
    const owners = await getWorkbenchOwners();
    const old = owners[productName];
    await patchWorkbenchProductOwner(productName, {
      productOwnerId: body.productOwnerId !== undefined ? body.productOwnerId : old?.productOwnerId ?? "",
      mediaOwnerId: body.mediaOwnerId !== undefined ? body.mediaOwnerId : old?.mediaOwnerId ?? "",
      creativeOwnerId: body.creativeOwnerId !== undefined ? body.creativeOwnerId : old?.creativeOwnerId ?? "",
      taskStatus: body.taskStatus !== undefined ? (body.taskStatus as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm") : old?.taskStatus ?? "unassigned",
    }, userId);
    const next = (await getWorkbenchOwners())[productName];
    res.json(next);
  });

  app.get("/api/workbench/tasks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const onlyMine = req.query.onlyMine === "1" || req.query.onlyMine === "true";
      const tasks = await getWorkbenchTasks(onlyMine ? { assigneeId: userId } : undefined);
      res.json(tasks);
    } catch (err) {
      console.error("[GET /api/workbench/tasks]", err);
      res.status(500).json({ message: "取得任務列表失敗", error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch("/api/workbench/tasks/batch", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { ids: string[]; status?: string; assigneeId?: string | null };
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      return res.status(400).json({ message: "ids 必須為非空陣列" });
    }
    const result = await batchUpdateWorkbenchTasks(
      body.ids,
      {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      },
      userId
    );
    res.json(result);
  });

  app.post("/api/workbench/tasks", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as {
      productName?: string; creativeId?: string; draftId?: string | null; reviewSessionId?: string | null; title: string; action: string; reason: string;
      assigneeId?: string | null; status?: string; notes?: string;
      taskSource?: string | null; priority?: string | null; dueDate?: string | null; impactAmount?: string | null; taskType?: string | null;
    };
    if (!body.title || !body.action || !body.reason) {
      return res.status(400).json({ message: "缺少 title / action / reason" });
    }
    const task = await createWorkbenchTask({
      productName: body.productName,
      creativeId: body.creativeId,
      draftId: body.draftId ?? undefined,
      reviewSessionId: body.reviewSessionId ?? undefined,
      title: body.title,
      action: body.action,
      reason: body.reason,
      assigneeId: body.assigneeId ?? null,
      status: (body.status as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm") || "unassigned",
      createdBy: userId,
      notes: body.notes ?? "",
      taskSource: body.taskSource ?? undefined,
      priority: body.priority ?? undefined,
      dueDate: body.dueDate ?? undefined,
      impactAmount: body.impactAmount ?? undefined,
      taskType: body.taskType ?? undefined,
    });
    res.status(201).json(task);
  });

  app.patch("/api/workbench/tasks/:id", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const id = req.params.id;
    const body = req.body as {
      assigneeId?: string | null; status?: string; notes?: string; updatedAt?: string | null;
      priority?: string | null; dueDate?: string | null; impactAmount?: string | null; taskType?: string | null; taskSource?: string | null;
    };
    const old = await getWorkbenchTask(id);
    if (!old) return res.status(404).json({ message: "任務不存在" });
    const result = await updateWorkbenchTask(
      id,
      {
        assigneeId: body.assigneeId !== undefined ? body.assigneeId : undefined,
        status: body.status as "unassigned" | "assigned" | "in_progress" | "done" | "pending_confirm" | undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        priority: body.priority !== undefined ? body.priority : undefined,
        dueDate: body.dueDate !== undefined ? body.dueDate : undefined,
        impactAmount: body.impactAmount !== undefined ? body.impactAmount : undefined,
        taskType: body.taskType !== undefined ? body.taskType : undefined,
        taskSource: body.taskSource !== undefined ? body.taskSource : undefined,
      },
      userId,
      body.updatedAt
    );
    if (result && "conflict" in result && result.conflict)
      return res.status(409).json({ message: "資料已被他人更新，請重新整理後再編輯", code: "CONFLICT" });
    if (!result) return res.status(404).json({ message: "任務不存在" });
    res.json(result);
  });

  app.get("/api/workbench/audit", requireAuth, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const log = await getWorkbenchAuditLog(limit);
    res.json(log);
  });

  /** P4 Team coverage 升級：在投商品缺 primary/backup owner、主責超載。需 batch 以得知哪些商品有 spend */
  app.get("/api/workbench/coverage-check", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const overrides = await getWorkbenchMappingOverrides();
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const productsWithSpend = new Set<string>();
    if (batch?.campaignMetrics?.length) {
      for (const c of batch.campaignMetrics as CampaignMetrics[]) {
        const productName = resolveProduct({ campaignId: c.campaignId, campaignName: c.campaignName });
        if (productName) productsWithSpend.add(productName);
      }
    }
    const owners = await getWorkbenchOwners();
    const missingPrimary: string[] = [];
    const missingBackup: string[] = [];
    const primaryCount = new Map<string, number>();
    const OVERLOAD_THRESHOLD = 6;
    for (const productName of productsWithSpend) {
      const o = owners[productName];
      const primary = o?.productOwnerId?.trim() || "";
      const backup = (o?.mediaOwnerId?.trim() || "") || (o?.creativeOwnerId?.trim() || "");
      if (!primary) missingPrimary.push(productName);
      else {
        primaryCount.set(primary, (primaryCount.get(primary) || 0) + 1);
      }
      if (primary && !backup) missingBackup.push(productName);
    }
    const overload = Array.from(primaryCount.entries())
      .filter(([, count]) => count > OVERLOAD_THRESHOLD)
      .map(([userId, asPrimaryCount]) => ({ userId, asPrimaryCount, limit: OVERLOAD_THRESHOLD }));
    res.json({
      productsWithSpend: Array.from(productsWithSpend),
      missingPrimary,
      missingBackup,
      overload,
    });
  });

  /** P2 商品映射：未映射清單、衝突、手動覆蓋（overrides 寫入 DB + audit） */
  app.get("/api/workbench/mapping/context", requireAuth, async (req, res) => {
    const batch = getBatchFromRequest(req);
    const overrides = await getWorkbenchMappingOverrides();
    if (!batch?.campaignMetrics?.length) {
      return res.json({ unmapped: [], conflicts: [], productNames: [] });
    }
    const resolveProduct = (row: { campaignId: string; campaignName: string }) =>
      resolveProductWithOverrides(row, overrides, (name) => parseCampaignNameToTags(name)?.productName ?? null);
    const rows = (batch.campaignMetrics as CampaignMetrics[]).map((c) => ({
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
    const unmapped: Array<{ campaignId: string; campaignName: string }> = [];
    const productNameSet = new Set<string>();
    const creativeToProducts = new Map<string, Set<string>>();
    for (const row of rows) {
      const productName = resolveProduct(row);
      if (productName) productNameSet.add(productName);
      else unmapped.push({ campaignId: row.campaignId, campaignName: row.campaignName });
      const tags = parseCampaignNameToTags(row.campaignName);
      if (tags) {
        const key = `${tags.materialStrategy}\t${tags.headlineSnippet}`;
        if (!creativeToProducts.has(key)) creativeToProducts.set(key, new Set());
        if (productName) creativeToProducts.get(key)!.add(productName);
      }
    }
    const conflicts: Array<{ creativeKey: string; products: string[] }> = [];
    for (const [key, products] of creativeToProducts) {
      if (products.size > 1) {
        const [ms, hs] = key.split("\t");
        conflicts.push({ creativeKey: `${ms} + ${hs}`, products: Array.from(products) });
      }
    }
    res.json({
      unmapped,
      conflicts,
      productNames: Array.from(productNameSet).sort(),
    });
  });

  app.put("/api/workbench/mapping/override", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as { campaignId: string; productName: string };
    if (!body.campaignId) return res.status(400).json({ message: "缺少 campaignId" });
    await setWorkbenchMappingOverride("campaign", body.campaignId, body.productName || "", userId);
    const record = await getWorkbenchMappingRecord();
    res.json(record);
  });

  // ---------- P2-3 AI 作戰設定：門檻 / Prompt 版本化 ----------
  app.get("/api/workbench/thresholds/published", requireAuth, async (_req, res) => {
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.get("/api/workbench/thresholds/draft", requireAuth, async (_req, res) => {
    const config = await getDraftThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/draft", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as Record<string, unknown>;
    await saveDraftThresholdConfig(body, userId);
    const config = await getDraftThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/publish", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const ok = await publishThreshold(userId);
    if (!ok) return res.status(400).json({ message: "無 draft 可發布" });
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.post("/api/workbench/thresholds/rollback", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const ok = await rollbackThreshold(userId);
    if (!ok) return res.status(400).json({ message: "無法回滾（需至少 2 個已發布版本）" });
    const config = await getPublishedThresholdConfig();
    res.json(config ?? {});
  });

  app.get("/api/workbench/prompts/:mode", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const meta = await getPublishedPromptWithMeta(mode);
    const draft = await getDraftPrompt(mode);
    res.json({
      published: meta?.content ?? "",
      draft: draft ?? "",
      publishedAt: meta?.publishedAt ?? null,
      publishedSummary: meta?.summary ?? "",
    });
  });

  app.post("/api/workbench/prompts/:mode/draft", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const body = req.body as { content: string };
    await saveDraftPrompt(mode, body.content ?? "");
    const draft = await getDraftPrompt(mode);
    res.json({ draft: draft ?? "" });
  });

  app.post("/api/workbench/prompts/:mode/publish", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const ok = await publishPrompt(mode, req.session.userId ?? undefined);
    if (!ok) return res.status(400).json({ message: "無 draft 可發布" });
    const published = await getPublishedPrompt(mode);
    res.json({ published: published ?? "" });
  });

  app.post("/api/workbench/prompts/:mode/rollback", requireAuth, async (req, res) => {
    const mode = req.params.mode as string;
    const ok = await rollbackPrompt(mode, req.session.userId ?? undefined);
    if (!ok) return res.status(400).json({ message: "無法回滾" });
    const published = await getPublishedPrompt(mode);
    res.json({ published: published ?? "" });
  });

  /** RICH BEAR 審判官：已啟用 Hidden Calibration 模組名稱（只讀摘要，供設定頁顯示） */
  app.get("/api/workbench/calibration-modules", requireAuth, (_req, res) => {
    const names = Object.values(CALIBRATION_MODULE_NAMES);
    res.json({ names });
  });

  return httpServer;
}
