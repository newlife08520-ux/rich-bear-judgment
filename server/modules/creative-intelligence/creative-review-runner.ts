/**
 * 6.1-C：從素材版本讀檔 → 組裝審判 prompt（不改 core 靈魂，沿用既有 assembly）→ Gemini → 寫入 DB。
 */
import { readFile } from "fs/promises";
import type { ContentJudgmentInput } from "@shared/schema";
import { contentTypeToJudgmentType, type ContentType, type JudgmentType } from "@shared/schema";
import { buildContentJudgmentUserPrompt } from "../../prompt-builder";
import {
  getAssembledSystemPrompt,
  suggestUIModeFromJudgmentType,
  type JudgmentType as RBJudgmentType,
} from "../../rich-bear-prompt-assembly";
import { callGeminiCreativeAssetReview, callGeminiVideoFrameReview } from "../../gemini";
import { extractVideoKeyframes } from "../asset/video-keyframes";
import { getPublishedPrompt } from "../../workbench-db";
import { storage } from "../../storage";
import * as assetVersionRepo from "../asset/asset-version-repository";
import * as assetPackageRepo from "../asset/asset-package-repository";
import { resolveFilePathForRequest } from "../asset/upload-provider";
import { parseUploadFilenameFromFileUrl } from "../meta-publish/meta-publish-graph-client";
import { extractPatternTagsFromPayload } from "./creative-review-tags";
import { createCreativeReviewWithTags } from "./creative-review-prisma";

export async function runCreativeReviewFromAssetVersion(params: {
  userId: string;
  apiKey: string;
  assetVersionId: string;
  reviewSource: string;
}): Promise<{ ok: true; reviewId: string } | { ok: false; message: string; code?: string }> {
  const v = assetVersionRepo.getById(params.userId, params.assetVersionId);
  if (!v?.fileUrl) {
    return { ok: false, message: "找不到素材版本或缺少檔案", code: "NOT_FOUND" };
  }
  const mime = (v.fileType ?? "image/jpeg").toLowerCase();
  const filename = parseUploadFilenameFromFileUrl(params.userId, v.fileUrl);
  if (!filename) {
    return { ok: false, message: "檔案需為本機上傳路徑 /api/uploads/...", code: "BAD_FILE_URL" };
  }
  const diskPath = resolveFilePathForRequest(params.userId, filename);
  if (!diskPath) {
    return { ok: false, message: "無法解析素材實體路徑", code: "NO_DISK_PATH" };
  }
  let buf: Buffer;
  try {
    buf = await readFile(diskPath);
  } catch {
    return { ok: false, message: "無法讀取素材檔案", code: "READ_FAILED" };
  }
  const pkg = assetPackageRepo.getById(params.userId, v.packageId);
  const productName = pkg?.brandProductName ?? pkg?.name ?? null;

  if (mime.startsWith("video/")) {
    let frames: { base64: string; timestampSec: number }[];
    try {
      frames = extractVideoKeyframes(buf, mime);
    } catch {
      frames = [];
    }
    if (frames.length === 0) {
      const uiMode = suggestUIModeFromJudgmentType("creative" as RBJudgmentType);
      const rec = await createCreativeReviewWithTags({
        userId: params.userId,
        assetVersionId: v.id,
        assetPackageId: v.packageId,
        productName,
        reviewSource: params.reviewSource,
        workflow: "audit",
        uiMode,
        reviewStatus: "completed",
        summary:
          "無法從影片擷取關鍵畫面（ffmpeg 不可用或影片格式不支援）。請改上傳首幀或關鍵畫面為圖片版本再審。",
        nextAction: "匯出首幀為 JPG/PNG 後上傳圖片版本。",
        problemType: "流程",
        confidence: "low",
        score: null,
        reasonsJson: JSON.stringify({ text: "video_keyframe_extract_failed" }),
        evidenceJson: JSON.stringify({ mime, note: "no_frames" }),
        tags: [
          { tagType: "format", tagValue: "video_keyframe_failed", weight: 1 },
          { tagType: "visual_motif", tagValue: "video_needs_image_fallback", weight: 0.2 },
        ],
      });
      return { ok: true, reviewId: rec.id };
    }

    const contentType: ContentType = "video";
    const judgmentType = contentTypeToJudgmentType(contentType) as JudgmentType;
    const uiMode = suggestUIModeFromJudgmentType(judgmentType as RBJudgmentType);
    const publishedMain = await getPublishedPrompt(uiMode);
    const systemPrompt = getAssembledSystemPrompt({
      uiMode,
      customMainPrompt: publishedMain,
      judgmentType: judgmentType as RBJudgmentType,
      workflow: "audit",
    });
    const input: ContentJudgmentInput = {
      purpose: "selling",
      depth: "full",
      notes: `素材包：${pkg?.name ?? ""}；檔名：${v.fileName ?? ""}；商品：${productName ?? ""}`,
      url: "",
      text: `請審判此影片素材版本（ID ${v.id}）。請只輸出單一 JSON 物件（勿 markdown），鍵需包含：oneLineVerdict, keyPoints, fullAnalysis, nextActions, followUpSuggestions；並額外附上 summary, nextAction, problemType, confidence, score(0-100), reasons, suggestions, evidence, blockingReasons, pendingItems（可省略空值）。`,
      detectedType: contentType,
    };
    const settings = storage.getSettings(params.userId);
    const baseUser = buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType);
    const userPrompt = `${baseUser}\n\n【重要】回覆必須為單一 JSON，結構須符合 CreativeAssetJudgmentPayload（含陳列欄位）。`;

    const payload = await callGeminiVideoFrameReview(params.apiKey, systemPrompt, userPrompt, frames);
    if (!payload) {
      return { ok: false, message: "AI 呼叫失敗", code: "AI_CALL_FAILED" };
    }

    const tags = extractPatternTagsFromPayload(payload);
    const reviewStatus =
      payload.oneLineVerdict.includes("解析失敗") && payload.keyPoints.length === 0 ? "failed" : "completed";

    const rec = await createCreativeReviewWithTags({
      userId: params.userId,
      assetVersionId: v.id,
      assetPackageId: v.packageId,
      productName,
      reviewSource: params.reviewSource,
      workflow: "audit",
      uiMode,
      reviewStatus,
      summary: payload.summary ?? payload.oneLineVerdict,
      nextAction: payload.nextAction ?? payload.nextActions?.[0]?.label,
      problemType: payload.problemType ?? null,
      confidence: payload.confidence ?? null,
      score: payload.score ?? null,
      reasonsJson: payload.reasons ? JSON.stringify({ text: payload.reasons }) : null,
      suggestionsJson: payload.suggestions ? JSON.stringify({ text: payload.suggestions }) : null,
      evidenceJson: payload.evidence
        ? JSON.stringify({ text: payload.evidence, frameCount: frames.length })
        : JSON.stringify({ frameCount: frames.length }),
      blockingJson: payload.blockingReasons?.length ? JSON.stringify(payload.blockingReasons) : null,
      pendingJson: payload.pendingItems?.length ? JSON.stringify(payload.pendingItems) : null,
      rawResultJson: JSON.stringify(payload),
      tags,
    });
    return { ok: true, reviewId: rec.id };
  }

  const isPdf = mime.startsWith("application/pdf") || mime.endsWith("/pdf");
  if (!mime.startsWith("image/") && !isPdf) {
    return { ok: false, message: "不支援的媒體類型", code: "UNSUPPORTED_MEDIA" };
  }

  const contentType: ContentType = isPdf ? "pdf" : "image";
  const judgmentType = contentTypeToJudgmentType(contentType) as JudgmentType;
  const uiMode = suggestUIModeFromJudgmentType(judgmentType as RBJudgmentType);
  const publishedMain = await getPublishedPrompt(uiMode);
  const systemPrompt = getAssembledSystemPrompt({
    uiMode,
    customMainPrompt: publishedMain,
    judgmentType: judgmentType as RBJudgmentType,
    workflow: "audit",
  });

  const input: ContentJudgmentInput = {
    purpose: "selling",
    depth: "full",
    notes: `素材包：${pkg?.name ?? ""}；檔名：${v.fileName ?? ""}；商品：${productName ?? ""}`,
    url: "",
    text: `請審判此素材版本（ID ${v.id}）。請只輸出單一 JSON 物件（勿 markdown），鍵需包含：oneLineVerdict, keyPoints, fullAnalysis, nextActions, followUpSuggestions；並額外附上 summary, nextAction, problemType, confidence, score(0-100), reasons, suggestions, evidence, blockingReasons, pendingItems（可省略空值）。`,
    detectedType: contentType,
  };
  const settings = storage.getSettings(params.userId);
  const baseUser = buildContentJudgmentUserPrompt(settings, input, contentType, judgmentType);
  const userPrompt = `${baseUser}\n\n【重要】回覆必須為單一 JSON，結構須符合 CreativeAssetJudgmentPayload（含陳列欄位）。`;

  const payload = await callGeminiCreativeAssetReview(
    params.apiKey,
    systemPrompt,
    userPrompt,
    buf.toString("base64"),
    isPdf ? "application/pdf" : mime
  );
  if (!payload) {
    return { ok: false, message: "AI 呼叫失敗", code: "AI_CALL_FAILED" };
  }

  const tags = extractPatternTagsFromPayload(payload);
  const reviewStatus =
    payload.oneLineVerdict.includes("解析失敗") && payload.keyPoints.length === 0 ? "failed" : "completed";

  const rec = await createCreativeReviewWithTags({
    userId: params.userId,
    assetVersionId: v.id,
    assetPackageId: v.packageId,
    productName,
    reviewSource: params.reviewSource,
    workflow: "audit",
    uiMode,
    reviewStatus,
    summary: payload.summary ?? payload.oneLineVerdict,
    nextAction: payload.nextAction ?? payload.nextActions?.[0]?.label,
    problemType: payload.problemType ?? null,
    confidence: payload.confidence ?? null,
    score: payload.score ?? null,
    reasonsJson: payload.reasons ? JSON.stringify({ text: payload.reasons }) : null,
    suggestionsJson: payload.suggestions ? JSON.stringify({ text: payload.suggestions }) : null,
    evidenceJson: payload.evidence ? JSON.stringify({ text: payload.evidence }) : null,
    blockingJson: payload.blockingReasons?.length ? JSON.stringify(payload.blockingReasons) : null,
    pendingJson: payload.pendingItems?.length ? JSON.stringify(payload.pendingItems) : null,
    rawResultJson: JSON.stringify(payload),
    tags,
  });

  return { ok: true, reviewId: rec.id };
}
