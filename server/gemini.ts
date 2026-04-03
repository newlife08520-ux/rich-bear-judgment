import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildFinalSystemPrompt, buildJudgmentUserPrompt, buildContentJudgmentPrompt, buildContentJudgmentUserPrompt } from "./prompt-builder";
import type { JudgmentInput, JudgmentReport, JudgmentType, UserSettings, ModuleDetail, ReportSummary, ReportGrade, Recommendation, ContentJudgmentInput, ContentType, ContentJudgmentResult, ChatMessage, CreativeDetail, LandingPageDetail, FbAdsDetail, GA4FunnelDetail } from "@shared/schema";
import { randomUUID } from "crypto";
import {
  JudgmentResponseSchema,
  ContentJudgmentResultSchema,
  CreativeAssetJudgmentPayloadSchema,
  type CreativeAssetJudgmentPayload,
} from "./gemini-response-schema";
import { extractJsonFromText } from "./lib/extract-json";

const VALID_GRADES: ReportGrade[] = ["S", "A", "B", "C", "D", "F"];
const VALID_RECOMMENDATIONS: Recommendation[] = ["launch", "scale", "hold", "stop", "fix_first"];

function scoreToGrade(score: number): ReportGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function buildFallbackSummary(): ReportSummary {
  return {
    score: 50,
    grade: "C",
    verdict: "AI 輸出解析失敗，已回傳預設結果",
    topIssues: [],
    priorityActions: [],
    recommendation: "hold",
    recommendationNote: "",
  };
}

function buildFallbackDetail(type: JudgmentType): ModuleDetail {
  const base = { reasoning: "解析失敗", executionSuggestions: [] as string[] };
  switch (type) {
    case "creative":
      return { type: "creative", ...base, diagnosis: {} as CreativeDetail["diagnosis"], hookIdeas: [], ctaIdeas: [], openingFixes: [], captionSuggestions: [] };
    case "landing_page":
      return { type: "landing_page", ...base, diagnosis: {} as LandingPageDetail["diagnosis"], deathPoints: [], rewriteIdeas: [], sectionFixes: [], aovSuggestions: [] };
    case "fb_ads":
      return { type: "fb_ads", ...base, diagnosis: {} as FbAdsDetail["diagnosis"], metricsAnalysis: [], fatigueSignals: [], audienceInsights: [], scalingAdvice: "" };
    case "ga4_funnel":
      return { type: "ga4_funnel", ...base, diagnosis: {} as GA4FunnelDetail["diagnosis"], funnelBreakpoints: [], pageFixIdeas: [], checkoutFixes: [], trafficAdvice: "" };
    default:
      return { type: "creative", ...base, diagnosis: {} as CreativeDetail["diagnosis"], hookIdeas: [], ctaIdeas: [], openingFixes: [], captionSuggestions: [] };
  }
}

/** Phase 4：結構化解析 + runtime 驗證；失敗必回 fallback，不讓 API crash。 */
function parseGeminiResponse(text: string, type: JudgmentType): { summary: ReportSummary; detail: ModuleDetail; isFallback: boolean } {
  const raw = extractJsonFromText(text);
  if (raw === null || typeof raw !== "object") {
    console.error("[Gemini] Failed to extract JSON from response");
    return { summary: buildFallbackSummary(), detail: buildFallbackDetail(type), isFallback: true };
  }
  const parsed = raw as Record<string, unknown>;
  const s = parsed.summary;
  const score = typeof s === "object" && s !== null && typeof (s as any).score === "number"
    ? Math.min(100, Math.max(0, (s as any).score))
    : 50;
  const grade = typeof s === "object" && s !== null && VALID_GRADES.includes((s as any).grade)
    ? (s as any).grade
    : scoreToGrade(score);
  const rec = typeof s === "object" && s !== null && VALID_RECOMMENDATIONS.includes((s as any).recommendation)
    ? (s as any).recommendation
    : "hold";

  const summary: ReportSummary = {
    score,
    grade,
    verdict: typeof s === "object" && s !== null && typeof (s as any).verdict === "string" ? (s as any).verdict : "AI 分析完成",
    topIssues: Array.isArray((s as any)?.topIssues) ? (s as any).topIssues : [],
    priorityActions: Array.isArray((s as any)?.priorityActions) ? (s as any).priorityActions : [],
    recommendation: rec,
    recommendationNote: typeof s === "object" && s !== null && typeof (s as any).recommendationNote === "string" ? (s as any).recommendationNote : "",
  };

  const detail: ModuleDetail = {
    ...(typeof parsed.detail === "object" && parsed.detail !== null ? (parsed.detail as object) : {}),
    type,
  } as ModuleDetail;

  const validated = JudgmentResponseSchema.safeParse({ summary, detail });
  if (!validated.success) {
    console.error("[Gemini] Schema validation failed:", validated.error.flatten());
    return { summary: buildFallbackSummary(), detail: buildFallbackDetail(type), isFallback: true };
  }
  return {
    summary: validated.data.summary as ReportSummary,
    detail: validated.data.detail as unknown as ModuleDetail,
    isFallback: false,
  } as { summary: ReportSummary; detail: ModuleDetail; isFallback: false };
}

/** 僅供 Phase 4 驗收腳本使用：解析文字並回傳（含 isFallback）。 */
export function parseGeminiResponseForTest(text: string, type: JudgmentType): { summary: ReportSummary; detail: ModuleDetail; isFallback: boolean } {
  return parseGeminiResponse(text, type);
}

export async function callGeminiJudgment(
  apiKey: string,
  settings: UserSettings,
  input: JudgmentInput,
  userId: string,
  modelName?: string,
): Promise<JudgmentReport | null> {
  const finalSystemPrompt = buildFinalSystemPrompt(settings, input.type);
  const userPrompt = buildJudgmentUserPrompt(input);

  console.log(`[Gemini] Calling model, type=${input.type}, objective=${input.objective}, systemPrompt=${finalSystemPrompt.length} chars`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName || process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
      systemInstruction: finalSystemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();

    console.log(`[Gemini] Response received (${responseText.length} chars)`);

    const parsed = parseGeminiResponse(responseText, input.type);
    if (parsed.isFallback) {
      console.warn("[Gemini] Parse/validation failed, returning fallback report");
    }

    const id = `judgment-${randomUUID().slice(0, 8)}`;
    const caseId = `case-${randomUUID().slice(0, 6)}`;

    const inputData: Record<string, any> = {};
    if (input.url) inputData.url = input.url;
    if (input.adCopy) inputData.adCopy = input.adCopy;
    if (input.metricsData) inputData.metricsData = input.metricsData;
    if (input.funnelData) inputData.funnelData = input.funnelData;

    const report: JudgmentReport = {
      id,
      caseId,
      version: 1,
      type: input.type,
      userId,
      createdAt: new Date().toISOString(),
      input: {
        objective: input.objective,
        notes: input.notes || undefined,
        rawData: Object.keys(inputData).length > 0 ? inputData : undefined,
      },
      summary: parsed.summary,
      detail: parsed.detail,
    };

    console.log(`[Gemini] Judgment created: id=${id}, score=${parsed.summary.score}, grade=${parsed.summary.grade}`);
    return report;
  } catch (e: any) {
    console.error(`[Gemini] API call failed:`, e.message || e);
    return null;
  }
}

const FALLBACK_CONTENT_RESULT: ContentJudgmentResult = {
  oneLineVerdict: "AI 輸出解析失敗，已回傳預設結果",
  keyPoints: [],
  fullAnalysis: [],
  nextActions: [],
  followUpSuggestions: [],
};

/** Phase 4：結構化解析 + schema-based runtime 驗證；失敗回 fallback，不 crash。 */
function parseContentJudgmentResponse(text: string): ContentJudgmentResult {
  const raw = extractJsonFromText(text);
  if (raw === null || typeof raw !== "object") {
    console.error("[Gemini] Failed to extract JSON from content judgment response");
    return FALLBACK_CONTENT_RESULT;
  }
  const p = raw as Record<string, unknown>;
  const candidate = {
    oneLineVerdict: typeof p.oneLineVerdict === "string" ? p.oneLineVerdict : "AI 分析完成",
    keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints : [],
    fullAnalysis: Array.isArray(p.fullAnalysis) ? p.fullAnalysis : [],
    nextActions: Array.isArray(p.nextActions) ? p.nextActions : [],
    followUpSuggestions: Array.isArray(p.followUpSuggestions) ? p.followUpSuggestions : [],
  };
  const validated = ContentJudgmentResultSchema.safeParse(candidate);
  if (!validated.success) {
    console.error("[Gemini] Content judgment schema validation failed:", validated.error.flatten());
    return FALLBACK_CONTENT_RESULT;
  }
  return validated.data as ContentJudgmentResult;
}

/** 僅供 Phase 4 驗收腳本使用。 */
export function parseContentJudgmentResponseForTest(text: string): ContentJudgmentResult {
  return parseContentJudgmentResponse(text);
}

/** 可選：當由呼叫端提供 workbench 組裝的 systemPrompt 與 userPrompt 時，不再使用 storage */
export interface ContentJudgmentOverrides {
  systemPrompt: string;
  userPrompt: string;
}

export async function callGeminiContentJudgment(
  apiKey: string,
  settings: UserSettings,
  input: ContentJudgmentInput,
  contentType: ContentType,
  judgmentType: JudgmentType,
  userId: string,
  overrides?: ContentJudgmentOverrides,
): Promise<ContentJudgmentResult | null> {
  const systemPrompt = overrides?.systemPrompt ?? buildContentJudgmentPrompt(settings, input, contentType, judgmentType).systemPrompt;
  const userPrompt = overrides?.userPrompt ?? buildContentJudgmentPrompt(settings, input, contentType, judgmentType).userPrompt;

  console.log(`[Gemini] Content judgment: contentType=${contentType}, purpose=${input.purpose}, depth=${input.depth}, workbench=${!!overrides}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();

    console.log(`[Gemini] Content judgment response (${responseText.length} chars)`);

    return parseContentJudgmentResponse(responseText);
  } catch (e: any) {
    console.error(`[Gemini] Content judgment API call failed:`, e.message || e);
    return null;
  }
}

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  fileData?: { mimeType: string; fileUri: string };
};

/** 將 ChatMessage[] 轉成 Gemini Chat history (Content[]) */
function chatMessagesToHistory(messages: ChatMessage[]): { role: string; parts: GeminiPart[] }[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/** 將新訊息的文字 + 附件轉成 Gemini parts（文字 + inlineData 或 fileData） */
function buildNewUserParts(
  text: string,
  attachments?: { type: string; data?: string; mimeType?: string; name?: string; fileUri?: string }[],
): GeminiPart[] {
  const parts: GeminiPart[] = [{ text }];
  if (attachments?.length) {
    for (const a of attachments) {
      if (a.fileUri && a.mimeType) {
        parts.push({ fileData: { mimeType: a.mimeType, fileUri: a.fileUri } });
      } else if (a.data && a.mimeType) {
        parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
      }
    }
  }
  return parts;
}

/**
 * 多輪對話：使用單一 systemPrompt + 完整 messages 呼叫 Gemini Chat API。
 * 支援多模態：newUserAttachments 可含 base64 data + mimeType，以 inlineData 送給模型。
 */
export async function callGeminiChat(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  newUserContent: string,
  newUserAttachments?: { type: string; data?: string; mimeType?: string; name?: string }[],
): Promise<string | null> {
  const effectivePrompt = (systemPrompt || "").trim();
  if (!effectivePrompt) {
    console.warn("[Gemini] Chat: systemPrompt 為空，使用預設說明");
  }

  const history = chatMessagesToHistory(messages);
  const modelName = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: effectivePrompt || "你是專業的行銷總監助手，請用繁體中文回覆。",
    });

    const chat = model.startChat({ history: history as any });
    const parts = buildNewUserParts(newUserContent, newUserAttachments);
    const result = await chat.sendMessage(parts as any);
    const text = result.response.text();
    console.log(`[Gemini] Chat response (${text.length} chars)`);
    return text;
  } catch (e: any) {
    console.error("[Gemini] Chat API call failed:", e.message || e);
    return null;
  }
}

const FALLBACK_CREATIVE_ASSET: CreativeAssetJudgmentPayload = {
  oneLineVerdict: "AI 輸出解析失敗，已回傳預設結果",
  keyPoints: [],
  fullAnalysis: [],
  nextActions: [],
  followUpSuggestions: [],
};

function parseCreativeAssetJudgmentResponse(text: string): CreativeAssetJudgmentPayload {
  const raw = extractJsonFromText(text);
  if (raw === null || typeof raw !== "object") {
    console.error("[Gemini] Failed to extract JSON from creative asset judgment");
    return FALLBACK_CREATIVE_ASSET;
  }
  const validated = CreativeAssetJudgmentPayloadSchema.safeParse(raw);
  if (!validated.success) {
    console.error("[Gemini] Creative asset judgment schema failed:", validated.error.flatten());
    return FALLBACK_CREATIVE_ASSET;
  }
  return validated.data;
}

/** 素材版本圖像 + 組裝後 system/user prompt → 單一 JSON（含 structured 欄位） */
export async function callGeminiCreativeAssetReview(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mimeType: string
): Promise<CreativeAssetJudgmentPayload | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: userPrompt },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
          ],
        },
      ],
    });
    const responseText = result.response.text();
    console.log(`[Gemini] Creative asset review (${responseText.length} chars)`);
    return parseCreativeAssetJudgmentResponse(responseText);
  } catch (e: any) {
    console.error(`[Gemini] Creative asset review API failed:`, e?.message || e);
    return null;
  }
}
