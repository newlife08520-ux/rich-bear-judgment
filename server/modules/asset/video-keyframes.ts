/**
 * 從影片抽取多張關鍵幀，回傳 base64 + 時間戳（供 Gemini 多幀審查）。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";

const TMP_DIR = path.join(process.cwd(), ".data", "tmp");

export interface ExtractedFrame {
  base64: string;
  timestampSec: number;
}

export function extractVideoKeyframes(videoBuffer: Buffer, mimeType: string, maxFrames = 5): ExtractedFrame[] {
  const lower = (mimeType || "").toLowerCase();
  const ext = lower.includes("webm") ? "webm" : lower.includes("mov") || lower.includes("quicktime") ? "mov" : "mp4";
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const tmpVideo = path.join(TMP_DIR, `vf-${Date.now()}-${id}.${ext}`);
  const frames: ExtractedFrame[] = [];

  try {
    fs.writeFileSync(tmpVideo, videoBuffer);
    let durationSec = 10;
    try {
      const probe = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpVideo}"`,
        { encoding: "utf-8", timeout: 10000 }
      ).trim();
      const d = parseFloat(probe);
      if (Number.isFinite(d) && d > 0) durationSec = d;
    } catch {
      /* ffprobe 不可用就用預設 */
    }

    const timestamps = [0];
    if (durationSec > 3) timestamps.push(3);
    const mid = Math.floor(durationSec / 2);
    if (mid > 4 && mid < durationSec - 3) timestamps.push(mid);
    if (durationSec > 6) timestamps.push(Math.max(durationSec - 3, 4));

    for (const ts of timestamps.slice(0, maxFrames)) {
      const framePath = path.join(TMP_DIR, `vf-${id}-${ts.toFixed(1)}.jpg`);
      try {
        execSync(`ffmpeg -v error -ss ${ts} -i "${tmpVideo}" -vframes 1 -q:v 2 -y "${framePath}"`, {
          encoding: "utf-8",
          timeout: 10000,
        });
        if (fs.existsSync(framePath)) {
          frames.push({ base64: fs.readFileSync(framePath).toString("base64"), timestampSec: ts });
          fs.unlinkSync(framePath);
        }
      } catch {
        /* 個別幀失敗不中斷 */
      }
    }
    return frames;
  } finally {
    try {
      if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo);
    } catch {
      /* ignore */
    }
  }
}
