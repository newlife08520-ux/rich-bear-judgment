import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildFinalSystemPrompt, buildJudgmentUserPrompt, buildContentJudgmentPrompt, buildContentJudgmentUserPrompt } from "./prompt-builder";
import type { JudgmentInput, JudgmentReport, JudgmentType, UserSettings, ModuleDetail, ReportSummary, ReportGrade, Recommendation, ContentJudgmentInput, ContentType, ContentJudgmentResult, ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";

function scoreToGrade(score: number): ReportGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function parseGeminiResponse(text: string, type: JudgmentType): { summary: ReportSummary; detail: ModuleDetail } | null {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    jsonStr = jsonStr.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(jsonStr);

    const summary: ReportSummary = {
      score: Math.min(100, Math.max(0, Number(parsed.summary?.score) || 50)),
      grade: (parsed.summary?.grade as ReportGrade) || scoreToGrade(parsed.summary?.score || 50),
      verdict: parsed.summary?.verdict || "AI 分析完成",
      topIssues: Array.isArray(parsed.summary?.topIssues) ? parsed.summary.topIssues : [],
      priorityActions: Array.isArray(parsed.summary?.priorityActions) ? parsed.summary.priorityActions : [],
      recommendation: (parsed.summary?.recommendation as Recommendation) || "hold",
      recommendationNote: parsed.summary?.recommendationNote || "",
    };

    const detail: ModuleDetail = {
      ...parsed.detail,
      type,
    };

    return { summary, detail };
  } catch (e) {
    console.error("[Gemini] Failed to parse response:", e);
    return null;
  }
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
    if (!parsed) {
      console.error("[Gemini] Could not parse structured response, falling back to mock");
      return null;
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

function parseContentJudgmentResponse(text: string): ContentJudgmentResult | null {
  try {
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    jsonStr = jsonStr.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      oneLineVerdict: parsed.oneLineVerdict || "AI 分析完成",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      fullAnalysis: Array.isArray(parsed.fullAnalysis) ? parsed.fullAnalysis : [],
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions) ? parsed.followUpSuggestions : [],
    };
  } catch (e) {
    console.error("[Gemini] Failed to parse content judgment response:", e);
    return null;
  }
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

    const parsed = parseContentJudgmentResponse(responseText);
    if (!parsed) return null;

    return parsed;
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
