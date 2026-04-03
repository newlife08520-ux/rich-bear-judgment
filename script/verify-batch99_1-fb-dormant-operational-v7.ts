import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fb = fs.readFileSync(path.join(root, "client", "src", "pages", "fb-ads", "FbAdsPageView.tsx"), "utf-8");
if (!fb.includes("fb-dormant-operational-v7")) {
  console.error("[FAIL] FbAdsPageView should expose fb-dormant-operational-v7");
  process.exit(1);
}
console.log("[PASS] verify-batch99_1 fb-dormant-operational-v7");
