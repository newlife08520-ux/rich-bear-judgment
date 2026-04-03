/**
 * Phase 3 驗收：上傳成功/失敗都會刪除 temp 檔（content-judgment 與 asset-package 兩處）。
 * 執行：npx tsx script/verify-phase3-upload-cleanup.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function main() {
  const routesPath = path.join(root, "server", "routes.ts");
  const routes = fs.readFileSync(routesPath, "utf-8");
  const contentJudgmentUpload = routes.indexOf("content-judgment/upload-file");
  if (contentJudgmentUpload === -1) {
    console.error("未通過：找不到 content-judgment upload 路由");
    process.exit(1);
  }
  const slice = routes.slice(contentJudgmentUpload, contentJudgmentUpload + 3500);
  if (!slice.includes("cleanupUploadTempFile")) {
    console.error("未通過：content-judgment 上傳應呼叫 cleanupUploadTempFile");
    process.exit(1);
  }
  if (!slice.includes("finally") || !slice.includes("tempPath") || !slice.includes("cleanupUploadTempFile(tempPath)")) {
    console.error("未通過：content-judgment 應在 finally 或錯誤路徑清理 tempPath");
    process.exit(1);
  }

  const assetPath = path.join(root, "server", "modules", "asset", "asset-package-routes.ts");
  const asset = fs.readFileSync(assetPath, "utf-8");
  const hasAssetCleanup = asset.includes("cleanupUploadTempFile") && (asset.includes("finally") || asset.includes("cleanup()"));
  if (!hasAssetCleanup) {
    console.error("未通過：asset-package 上傳應在處理後 cleanup temp");
    process.exit(1);
  }
  console.log("通過：content-judgment 與 asset-package 上傳皆在成功/失敗路徑 cleanup temp。");
  process.exit(0);
}

main();
