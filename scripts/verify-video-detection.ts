/**
 * 影片偵測驗證：對本機影片檔呼叫 detectMedia，輸出 detectStatus / detectSource / aspectRatio。
 * 用於取得 success / fallback / failed 之實測結果（不經 HTTP 上傳）。
 * 用法：npx tsx scripts/verify-video-detection.ts <影片路徑> [檔名用於 fallback]
 * 例：npx tsx scripts/verify-video-detection.ts ./test.mp4
 *     npx tsx scripts/verify-video-detection.ts ./no-extension 9x16.mp4  （第二參數為模擬檔名，用於檔名推測）
 */
import * as fs from "fs";
import * as path from "path";
import { detectMedia } from "../server/modules/asset/detect-media";

const filePath = process.argv[2];
const fileNameOverride = process.argv[3]; // 可選，用於測試檔名 fallback（如 9x16.mp4）

if (!filePath) {
  console.error("用法: npx tsx scripts/verify-video-detection.ts <影片路徑> [模擬檔名]");
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), filePath);
if (!fs.existsSync(resolved)) {
  console.error("檔案不存在:", resolved);
  process.exit(1);
}

const buffer = fs.readFileSync(resolved);
const ext = path.extname(resolved).toLowerCase();
const mime =
  ext === ".mp4"
    ? "video/mp4"
    : ext === ".webm"
      ? "video/webm"
      : ext === ".mov"
        ? "video/quicktime"
        : "video/mp4";
const fileName = fileNameOverride ?? path.basename(resolved);

const result = detectMedia(buffer, mime, fileName);
console.log("detectStatus:", result.detectStatus);
console.log("detectSource:", result.detectSource);
console.log("detectedAspectRatio:", result.detectedAspectRatio ?? "(無)");
console.log("detectedWidth:", result.detectedWidth ?? "(無)");
console.log("detectedHeight:", result.detectedHeight ?? "(無)");
console.log("detectedDurationSeconds:", result.detectedDurationSeconds ?? "(無)");
console.log("---");
console.log(
  result.detectStatus === "success"
    ? "結果: success（metadata 偵測成功）"
    : result.detectStatus === "fallback"
      ? "結果: fallback（依檔名推測）"
      : "結果: failed（需手動選擇比例）"
);
