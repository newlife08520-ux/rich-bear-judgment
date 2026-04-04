import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { settingsSchema, breakEvenRoas, targetRoas } from "@shared/schema";
import { getProductProfitRules, getProductProfitRule, setProductProfitRule } from "../profit-rules-store";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

export function registerSettingsRoutes(app: Express, requireAuth: RequireAuth): void {
  app.post("/api/settings/test-connection", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const type = req.body?.type;
    const valueRaw = req.body?.value;
    const value = typeof valueRaw === "string" ? valueRaw : String(valueRaw ?? "");
    const checkedAt = new Date().toISOString();
    const storageType = type === "ga4" || type === "fb" || type === "ai" ? type : undefined;

    const persistVerification = async (success: boolean, lastError?: string | null) => {
      if (storageType)
        await storage.patchVerificationStatus(
          userId,
          storageType,
          { status: success ? "success" : "error", verifiedAt: checkedAt, lastError: success ? null : (lastError ?? null) },
          value
        );
    };

    const sendError = async (payload: { message: string; errorCode: string; statusCode?: number; testedModel?: string; productionModel?: string; providerErrorMessage?: string; [k: string]: unknown }) => {
      if (storageType) await persistVerification(false, payload.message);
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
      return await sendError({ message: "????????????", errorCode: "INVALID_TYPE", statusCode: 400 });
    }
    if (!value.trim()) {
      const emptyMessages: Record<string, string> = {
        ai: "???? API Key????????AI ?????API ???",
        fb: "???? Access Token????????Facebook API ??????",
        ga4: "???? Property ID????????GA4 ??? ID",
      };
      return await sendError({ message: emptyMessages[type] || "????????", errorCode: "EMPTY_VALUE" });
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
            await persistVerification(true);
            return res.json({ success: true, status: "success", message: `API Key ???????????????? Gemini API?????????????? ${productionModel}`, testedModel: testModel, productionModel, checkedAt });
          }
          return await sendError({ message: "???????????????? API Key ???????", errorCode: "EMPTY_RESPONSE", testedModel: testModel, productionModel });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (errMsg === "TIMEOUT") {
            return await sendError({ message: "????????????15 ????????????", errorCode: "TIMEOUT", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid")) {
            return await sendError({ message: "API Key ????????????????????", errorCode: "API_KEY_INVALID", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("not found") || errMsg.includes("is not found")) {
            return await sendError({ message: `??? ${testModel} ?????????????????????`, errorCode: "MODEL_NOT_FOUND", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("permission") || errMsg.includes("PERMISSION_DENIED")) {
            return await sendError({ message: "API Key ???????? Gemini API", errorCode: "PERMISSION_DENIED", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            return await sendError({ message: "API ??????????????????????????", errorCode: "QUOTA_EXHAUSTED", testedModel: testModel, productionModel, providerErrorMessage });
          }
          if (errMsg.includes("billing") || errMsg.includes("BILLING")) {
            return await sendError({ message: "?????????????? Google Cloud ?????", errorCode: "BILLING_ERROR", testedModel: testModel, productionModel, providerErrorMessage });
          }
          return await sendError({ message: `AI ??????: ${errMsg.slice(0, 200)}`, errorCode: "AI_ERROR", testedModel: testModel, productionModel, providerErrorMessage });
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
            await persistVerification(true);
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
                await persistVerification(false, "Facebook Access Token ??????????????????Token");
                return res.json({ success: false, status: "error", message: "Facebook Access Token ??????????????????Token", errorCode: "FB_TOKEN_EXPIRED", checkedAt });
              }
              await persistVerification(false, `Facebook Access Token ????: ${fbError.message}`);
              return res.json({ success: false, status: "error", message: `Facebook Access Token ????: ${fbError.message}`, errorCode: "FB_TOKEN_INVALID", checkedAt });
            }
            if (fbError.code === 10 || fbError.code === 200) {
              await persistVerification(false, `Facebook Token ?????: ${fbError.message}`);
              return res.json({ success: false, status: "error", message: `Facebook Token ?????: ${fbError.message}`, errorCode: "FB_PERMISSION_DENIED", checkedAt });
            }
            await persistVerification(false, `Facebook API ???: ${fbError.message}`);
            return res.json({ success: false, status: "error", message: `Facebook API ???: ${fbError.message}`, errorCode: "FB_API_ERROR", checkedAt });
          }
          await persistVerification(false, "Facebook API ???????????????");
          return res.json({ success: false, status: "error", message: "Facebook API ???????????????", errorCode: "FB_UNKNOWN", checkedAt });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.message?.includes("fetch")) {
            await persistVerification(false, "?????????Facebook API??????????");
            return res.json({ success: false, status: "error", message: "?????????Facebook API??????????", errorCode: "NETWORK_ERROR", statusCode: 200, providerErrorMessage, checkedAt });
          }
          await persistVerification(false, `Facebook ??????: ${errMsg.slice(0, 200)}`);
          return res.json({ success: false, status: "error", message: `Facebook ??????: ${errMsg.slice(0, 200)}`, errorCode: "FB_ERROR", statusCode: 200, providerErrorMessage, checkedAt });
        }
      }

      if (type === "ga4") {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) {
          await persistVerification(false, "GA4 Property ID ?????????????????? (???: 123456789)");
          return res.json({ success: false, status: "error", message: "GA4 Property ID ?????????????????? (???: 123456789)", errorCode: "GA4_FORMAT_INVALID", checkedAt });
        }
        const saKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!saKeyJson) {
          await persistVerification(false, "??????? Service Account ????");
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
          await persistVerification(false, "Service Account ??????????JSON ????????");
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
            await persistVerification(false, "???????? Access Token");
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
            await persistVerification(true);
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
              await persistVerification(false, "Service Account ?????????????????????????");
              return res.json({ success: false, status: "error", message: "Service Account ?????????????????????????", errorCode: "GA4_UNAUTHENTICATED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "PERMISSION_DENIED" || ga4Error.code === 403) {
              const msg = (ga4Error.message || "").toLowerCase();
              if (msg.includes("api not enabled") || msg.includes("has not been used") || msg.includes("analyticsdata")) {
                await persistVerification(false, "Google Analytics Data API ?????");
                return res.json({ success: false, status: "error", message: `Google Analytics Data API ???????????Google Cloud Console ??? "Google Analytics Data API" (???: ${credentials.project_id})`, errorCode: "GA4_API_NOT_ENABLED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
              }
              await persistVerification(false, `Service Account ??? GA4 Property ${trimmed} ??????????`);
              return res.json({ success: false, status: "error", message: `Service Account (${credentials.client_email}) ??? GA4 Property ${trimmed} ???????????????GA4 ????? > Property Access Management ??????Service Account ?????Viewer ??`, errorCode: "GA4_PERMISSION_DENIED", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "NOT_FOUND" || ga4Error.code === 404) {
              await persistVerification(false, `GA4 Property ID ${trimmed} ?????`);
              return res.json({ success: false, status: "error", message: `GA4 Property ID ${trimmed} ???????????Property ID ???????`, errorCode: "GA4_NOT_FOUND", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            if (ga4Error.status === "INVALID_ARGUMENT" || ga4Error.code === 400) {
              await persistVerification(false, `GA4 API ??????: ${ga4Error.message}`);
              return res.json({ success: false, status: "error", message: `GA4 API ??????: ${ga4Error.message}`, errorCode: "GA4_INVALID_ARGUMENT", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
            }
            await persistVerification(false, `GA4 API ???: ${ga4Error.message || ga4Error.status}`);
            return res.json({ success: false, status: "error", message: `GA4 API ???: ${ga4Error.message || ga4Error.status}`, errorCode: "GA4_API_ERROR", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
          }
          await persistVerification(false, "GA4 API ???????????????");
          return res.json({ success: false, status: "error", message: "GA4 API ???????????????", errorCode: "GA4_UNKNOWN", ga4Detail: { propertyId: trimmed, authConfigured: true, serviceAccount: credentials.client_email }, checkedAt });
        } catch (err: any) {
          const errMsg = err?.message ?? String(err);
          const providerErrorMessage = errMsg.slice(0, 500);
          if (errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("network")) {
            await persistVerification(false, "?????????Google Analytics API??????????");
            return res.json({ success: false, status: "error", message: "?????????Google Analytics API??????????", errorCode: "NETWORK_ERROR", statusCode: 200, providerErrorMessage, ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          if (errMsg.includes("invalid_grant") || errMsg.includes("Invalid JWT")) {
            await persistVerification(false, "Service Account ????????????????????????????");
            return res.json({ success: false, status: "error", message: "Service Account ????????????????????????????", errorCode: "GA4_INVALID_CRED", statusCode: 200, providerErrorMessage, ga4Detail: { propertyId: trimmed, authConfigured: true }, checkedAt });
          }
          await persistVerification(false, `GA4 ??????: ${errMsg.slice(0, 200)}`);
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

  app.put("/api/settings", requireAuth, async (req, res) => {
    const result = settingsSchema.safeParse(req.body);
    if (!result.success) {
      const errPayload = { message: "?????????????", errors: result.error.flatten() };
      console.error("[PUT /api/settings] validation failed", JSON.stringify(result.error.flatten(), null, 2));
      return res.status(400).json(errPayload);
    }
    const settings = await storage.saveSettings(req.session.userId!, result.data);
    res.json(settings);
  });
}
