import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "docs", "active", "HOMEPAGE-COMMAND-HIERARCHY.md");
if (!fs.existsSync(p)) {
  console.error("[FAIL] missing HOMEPAGE-COMMAND-HIERARCHY.md");
  process.exit(1);
}
const t = fs.readFileSync(p, "utf-8");
for (const w of ["Primary", "Secondary", "Diagnostics"]) {
  if (!t.includes(w)) {
    console.error("[FAIL] hierarchy doc should mention", w);
    process.exit(1);
  }
}
const chrome = fs.readFileSync(
  path.join(root, "client", "src", "pages", "dashboard", "widgets", "HomepageCommandPanelV12.tsx"),
  "utf-8",
);
if (!chrome.includes("block-command-hierarchy-v12")) {
  console.error("[FAIL] V12 chrome missing hierarchy testid");
  process.exit(1);
}
console.log("[PASS] verify-batch98_1 homepage-command-hierarchy-v12");
