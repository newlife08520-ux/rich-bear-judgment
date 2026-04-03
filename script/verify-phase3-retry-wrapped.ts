/**
 * Phase 3 驗收：Retry 已套進 Meta/GA4 外部 fetch 路徑（refresh-pipeline 內 withExponentialBackoff 包住 fetch）。
 * 執行：npx tsx script/verify-phase3-retry-wrapped.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pipelinePath = path.join(root, "server", "refresh-pipeline.ts");

function main() {
  const content = fs.readFileSync(pipelinePath, "utf-8");
  if (!content.includes("withExponentialBackoff")) {
    console.error("未通過：refresh-pipeline 應使用 withExponentialBackoff");
    process.exit(1);
  }
  const count = (content.match(/withExponentialBackoff/g) || []).length;
  if (count < 4) {
    console.error("未通過：至少 4 處外部 fetch（Meta campaign、GA4 funnel、multi-window、GA4 page）應被 withExponentialBackoff 包住");
    process.exit(1);
  }
  const required = ["fetchMetaCampaignData", "fetchGA4FunnelData", "fetchMultiWindowMetrics", "fetchGA4PageData"];
  for (const name of required) {
    const idx = content.lastIndexOf(name);
    if (idx === -1) continue;
    const snippet = content.slice(Math.max(0, idx - 500), idx + 50);
    if (!snippet.includes("withExponentialBackoff")) {
      console.error(`未通過：${name} 應在 withExponentialBackoff 內呼叫`);
      process.exit(1);
    }
  }
  console.log("通過：Meta/GA4 外部 fetch 路徑已套入 withExponentialBackoff。");
  process.exit(0);
}

main();
