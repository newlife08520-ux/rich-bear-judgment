import type { Express, Request, Response, NextFunction } from "express";
import * as fs from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import {
  contentJudgmentInputSchema,
  contentJudgmentChatRequestSchema,
  type Workflow,
  detectContentType,
  contentTypeToJudgmentType,
  type AnalysisBatch,
} from "@shared/schema";
import { storage } from "../storage";
import { callGeminiContentJudgment, callGeminiChat } from "../gemini";
import { buildContentJudgmentUserPrompt } from "../prompt-builder";
import { enrichContentWithUrls } from "../url-scraper";
import { createDiskStorage, cleanupUploadTempFile } from "../lib/upload-temp";
import { getPublishedPrompt } from "../workbench-db";
import {
  getAssembledSystemPrompt,
  suggestUIModeFromJudgmentType,
  type UIMode,
  type JudgmentType as AssemblyJudgmentType,
} from "../rich-bear-prompt-assembly";
import { parseStructuredJudgmentFromResponse } from "../parse-structured-judgment";
import { validateJudgmentAgainstSystemAction } from "../lib/judgment-alignment";
import { setInitialVerdict } from "../initial-verdicts-store";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;
type GetBatchFromRequest = (req: Request) => AnalysisBatch | null;

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

function inferWorkflow(content: string): Workflow {
  const t = content.trim().toLowerCase();
  if (/審判|判斷|審核|評估|看|診斷|分析|audit/.test(t)) return "audit";
  if (/創建|產生|製作|產出|生成|寫|建立/.test(t)) return "create";
  if (/策略|方向|建議|怎麼做|戰略|規劃/.test(t)) return "strategy";
  if (/任務|待辦|執行|步驟|清單/.test(t)) return "task";
  return "clarify";
}

function isInputSufficientForAudit(message: {
  content: string;
  attachments?: { type: string; url?: string; name?: string }[];
}): boolean {
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
  const hasUrl = /https?:\/\/\S+/i.test(message.content.trim());
  const minLength = 30;
  const sufficientLength = message.content.trim().length >= minLength;
  return hasAttachments || hasUrl || sufficientLength;
}

export function registerJudgmentApiRoutes(
  app: Express,
  requireAuth: RequireAuth,
  getBatchFromRequest: GetBatchFromRequest
): void {
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
      const { sessionId, message, uiMode, workflow: bodyWorkflow, contextCampaignId } = parsed.data;
      const effectiveMode: UIMode = uiMode && ["boss", "buyer", "creative"].includes(uiMode) ? (uiMode as UIMode) : "creative";
      const publishedMain = await getPublishedPrompt(effectiveMode);
      const effectiveWorkflow: Workflow =
        bodyWorkflow && ["clarify", "create", "audit", "strategy", "task"].includes(bodyWorkflow)
          ? bodyWorkflow
          : inferWorkflow(message.content);

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
        const userMessage = {
          id: userMsgId,
          role: "user" as const,
          content: message.content,
          attachments: message.attachments?.map((a) => ({ type: a.type, url: "", name: a.name })),
          createdAt: now,
        };
        if (!session) {
          session = { id: `rs-${randomUUID().slice(0, 8)}`, userId, title: message.content.slice(0, 50).trim() || "????", messages: [], createdAt: now, updatedAt: now };
        }
        session.messages.push(userMessage);
        const assistantMsgId = `msg-${randomUUID().slice(0, 8)}`;
        session.messages.push({ id: assistantMsgId, role: "assistant" as const, content: needMoreMsg, createdAt: now });
        session.updatedAt = now;
        await storage.saveReviewSession(session);
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
      await storage.saveReviewSession(session);

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
}
