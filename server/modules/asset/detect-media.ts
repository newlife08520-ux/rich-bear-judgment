/**
 * 上傳後從 buffer 偵測圖片/影片的 width、height、duration，並推算出 aspectRatio。
 * 圖片：使用 image-size。
 * 影片：使用 ffprobe（需主機已安裝 ffmpeg）。
 *
 * 影片偵測失敗時（detectVideoFfprobe 回傳 null）：
 * - 可能原因：ffprobe 未安裝／不在 PATH（ENOENT）、權限不足、逾時、或 JSON 解析/串流格式問題。
 * - detectMedia 會先嘗試檔名推測（如 9x16）→ fallback；否則回傳 detectStatus: "failed", detectSource: "manual"。
 * - 前端：版本卡顯示 Badge「待確認」，title 為「比例偵測失敗；請確認主機已安裝 ffmpeg（ffprobe）或手動選擇比例」。
 * 正式環境驗證：請呼叫 GET /api/health/ffprobe，若 ok: false 則依 code（ENOENT/PERM/TIMEOUT/OTHER）排查。
 */
import imageSize from "image-size";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import type { AssetAspectRatio } from "@shared/schema";
import { parseAspectRatioFromText } from "@shared/parse-asset-name";

const RATIOS: { ratio: AssetAspectRatio; value: number }[] = [
  { ratio: "9:16", value: 9 / 16 },
  { ratio: "4:5", value: 4 / 5 },
  { ratio: "1:1", value: 1 },
  { ratio: "16:9", value: 16 / 9 },
];

function closestAspectRatio(w: number, h: number): AssetAspectRatio {
  if (!h || h <= 0) return "1:1";
  const r = w / h;
  let best: AssetAspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const { ratio, value } of RATIOS) {
    const diff = Math.abs(r - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

export type DetectionResult = {
  detectedWidth?: number;
  detectedHeight?: number;
  detectedAspectRatio?: AssetAspectRatio;
  detectedDurationSeconds?: number;
  detectStatus: "success" | "fallback" | "failed";
  detectSource: "metadata" | "filename" | "manual";
};

/**
 * 從 buffer 偵測圖片尺寸；僅支援常見圖片格式。
 */
function detectImage(buffer: Buffer): DetectionResult | null {
  try {
    const dims = imageSize(buffer);
    const w = dims.width;
    const h = dims.height;
    if (typeof w !== "number" || typeof h !== "number" || w <= 0 || h <= 0) {
      return null;
    }
    return {
      detectedWidth: w,
      detectedHeight: h,
      detectedAspectRatio: closestAspectRatio(w, h),
      detectStatus: "success",
      detectSource: "metadata",
    };
  } catch {
    return null;
  }
}

/**
 * 從檔名推測比例；用於 fallback。與 shared/parse-asset-name 規則一致（支援 x × : _）。
 */
function guessRatioFromFilename(fileName: string): AssetAspectRatio | null {
  const base = path.basename(fileName, path.extname(fileName));
  return parseAspectRatioFromText(base);
}

/**
 * 使用 ffprobe 讀取影片 metadata；需系統已安裝 ffmpeg。
 * 將 buffer 寫入暫存檔後執行 ffprobe，讀完即刪。
 */
function detectVideoFfprobe(buffer: Buffer, mimeType: string): DetectionResult | null {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mov") ? "mov" : "mp4";
  const tmpDir = path.join(process.cwd(), ".data", "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const tmpFile = path.join(tmpDir, `detect-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  try {
    fs.writeFileSync(tmpFile, buffer);
    const out = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of json -i "${tmpFile}"`,
      { encoding: "utf-8", maxBuffer: 1024 * 1024, timeout: 15000 }
    );
    const data = JSON.parse(out) as { streams?: Array<{ width?: number; height?: number; duration?: string }> };
    const stream = data.streams?.[0];
    const w = stream?.width;
    const h = stream?.height;
    const durStr = stream?.duration;
    const durationSeconds = durStr != null ? parseFloat(durStr) : undefined;
    if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
      return {
        detectedWidth: w,
        detectedHeight: h,
        detectedAspectRatio: closestAspectRatio(w, h),
        detectedDurationSeconds: durationSeconds != null && Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : undefined,
        detectStatus: "success",
        detectSource: "metadata",
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * 依 mimeType 與 buffer 偵測媒體；回傳 detection 或 fallback/failed。
 */
export function detectMedia(buffer: Buffer, mimeType: string, fileName: string): DetectionResult {
  const isImage = (mimeType || "").toLowerCase().startsWith("image/");
  const isVideo = (mimeType || "").toLowerCase().startsWith("video/");

  if (isImage) {
    const result = detectImage(buffer);
    if (result) return result;
    const fallbackRatio = guessRatioFromFilename(fileName);
    if (fallbackRatio) {
      return { detectedAspectRatio: fallbackRatio, detectStatus: "fallback", detectSource: "filename" };
    }
    return { detectStatus: "failed", detectSource: "manual" };
  }

  if (isVideo) {
    const result = detectVideoFfprobe(buffer, mimeType);
    if (result) return result;
    const fallbackRatio = guessRatioFromFilename(fileName);
    if (fallbackRatio) {
      return { detectedAspectRatio: fallbackRatio, detectStatus: "fallback", detectSource: "filename" };
    }
    return { detectStatus: "failed", detectSource: "manual" };
  }

  const fallbackRatio = guessRatioFromFilename(fileName);
  if (fallbackRatio) {
    return { detectedAspectRatio: fallbackRatio, detectStatus: "fallback", detectSource: "filename" };
  }
  return { detectStatus: "failed", detectSource: "manual" };
}
