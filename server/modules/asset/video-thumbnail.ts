/**
 * 影片縮圖：用 ffmpeg 從 buffer 擷取一幀為 jpg，存至 uploads 目錄，回傳 thumbnailUrl。
 * 失敗時回傳 null，呼叫端須 fallback（例如前端用 <video> 第一幀）。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

const UPLOAD_BASE = path.join(process.cwd(), ".data", "uploads");
const URL_PREFIX = "/api/uploads";
const TMP_DIR = path.join(process.cwd(), ".data", "tmp");

export function generateVideoThumbnail(
  userId: string,
  videoBuffer: Buffer,
  mimeType: string,
  originalName: string
): string | null {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mov") ? "mov" : "mp4";
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  const tmpVideo = path.join(TMP_DIR, `thumb-src-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`);
  const dir = path.join(UPLOAD_BASE, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const thumbFilename = `thumb_${randomUUID().slice(0, 8)}.jpg`;
  const thumbPath = path.join(dir, thumbFilename);

  try {
    fs.writeFileSync(tmpVideo, videoBuffer);
    execSync(
      `ffmpeg -v error -i "${tmpVideo}" -vframes 1 -q:v 2 -y "${thumbPath}"`,
      { encoding: "utf-8", timeout: 15000, maxBuffer: 1024 * 1024 }
    );
    if (!fs.existsSync(thumbPath)) return null;
    return `${URL_PREFIX}/${userId}/${thumbFilename}`;
  } catch {
    try {
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch {}
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo);
    } catch {}
  }
}
