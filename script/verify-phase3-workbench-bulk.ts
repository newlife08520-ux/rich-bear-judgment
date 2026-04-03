/**
 * Phase 3 驗收：workbench batch 寫入使用 createWorkbenchTasksBatch，不再逐筆 await createWorkbenchTask。
 * 執行：npx tsx script/verify-phase3-workbench-bulk.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const routesPath = path.join(root, "server", "routes.ts");
const workbenchRoutesPath = path.join(root, "server", "routes", "workbench-routes.ts");

function main() {
  /** POST batch 已拆至 workbench-routes 時仍須通過同一約束 */
  let routes = "";
  if (fs.existsSync(workbenchRoutesPath)) {
    routes = fs.readFileSync(workbenchRoutesPath, "utf-8");
  } else {
    routes = fs.readFileSync(routesPath, "utf-8");
  }
  const batchStart = routes.indexOf("/api/workbench/tasks/batch");
  if (batchStart < 0) {
    console.error("未通過：找不到 /api/workbench/tasks/batch 路由定義");
    process.exit(1);
  }
  const batchSection = routes.slice(batchStart, batchStart + 2500);
  const usesBatch = batchSection.includes("createWorkbenchTasksBatch");
  const hasLoopCreate = /for\s*\([^)]+\)\s*\{[^}]*await\s+createWorkbenchTask\s*\(/.test(routes);
  if (!usesBatch) {
    console.error("未通過：POST /api/workbench/tasks/batch 應使用 createWorkbenchTasksBatch");
    process.exit(1);
  }
  if (hasLoopCreate && batchSection.includes("createWorkbenchTask")) {
    console.error("未通過：batch 路徑不應以 for 迴圈逐筆 createWorkbenchTask");
    process.exit(1);
  }
  const workbenchDb = fs.readFileSync(path.join(root, "server", "workbench-db.ts"), "utf-8");
  if (!workbenchDb.includes("createWorkbenchTasksBatch") || !workbenchDb.includes("$transaction")) {
    console.error("未通過：workbench-db 應有 createWorkbenchTasksBatch 且以 transaction 批次寫入");
    process.exit(1);
  }
  console.log("通過：workbench batch 使用 createWorkbenchTasksBatch，無 N+1 逐筆 create。");
  process.exit(0);
}

main();
