/**
 * 驗收：Live 決策路徑不得使用 mock GA4。
 * 依 cursor_acceptance_gap_closure 清單 Step 3.3。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const LIVE_FILES = [
  "server/routes.ts",
  "server/build-action-center-payload.ts",
];

function main() {
  let failed = 0;
  for (const rel of LIVE_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf-8");
    if (content.includes("fetchMockGA4DataByProduct")) {
      console.error(`[FAIL] ${rel} still uses fetchMockGA4DataByProduct (mock GA4 in live path)`);
      failed++;
    } else {
      console.log(`[OK] ${rel} does not use fetchMockGA4DataByProduct`);
    }
  }
  console.log("\n[verify-no-mock-in-live-decision] failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

main();
