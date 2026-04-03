/**
 * 驗收：Dashboard 單一上下文 — 使用 useAppScope 且主要資料來自 action-center。
 * 依 cursor_acceptance_gap_closure 清單 Step 3.2。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dashboardPath = path.join(root, "client/src/pages/dashboard.tsx");

function main() {
  if (!fs.existsSync(dashboardPath)) {
    console.error("[FAIL] dashboard.tsx not found");
    process.exit(1);
  }
  const content = fs.readFileSync(dashboardPath, "utf-8");
  let failed = 0;
  if (!content.includes("useAppScope")) {
    console.error("[FAIL] dashboard.tsx should use useAppScope for scope context");
    failed++;
  } else {
    console.log("[OK] dashboard.tsx uses useAppScope");
  }
  if (!content.includes("/api/dashboard/action-center")) {
    console.error("[FAIL] dashboard.tsx should use /api/dashboard/action-center as main data source");
    failed++;
  } else {
    console.log("[OK] dashboard.tsx uses action-center API");
  }
  console.log("\n[verify-dashboard-scope-unification] failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

main();
