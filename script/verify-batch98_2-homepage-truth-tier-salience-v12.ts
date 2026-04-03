import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guide = path.join(root, "docs", "active", "HOMEPAGE-TRUTH-TIER-GUIDE.md");
if (!fs.existsSync(guide)) {
  console.error("[FAIL] missing HOMEPAGE-TRUTH-TIER-GUIDE.md");
  process.exit(1);
}
const chrome = fs.readFileSync(
  path.join(root, "client", "src", "pages", "dashboard", "widgets", "HomepageCommandPanelV12.tsx"),
  "utf-8",
);
if (!chrome.includes("truth-tier-partial-salience-v12") || !chrome.includes("grid-homepage-truth-tier-v12")) {
  console.error("[FAIL] V12 truth tier salience testids");
  process.exit(1);
}
console.log("[PASS] verify-batch98_2 homepage-truth-tier-salience-v12");
