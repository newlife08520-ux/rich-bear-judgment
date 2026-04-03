import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "docs", "active", "JUDGMENT-FOCUS-DENSITY-BUDGET.md");
if (!fs.existsSync(p)) {
  console.error("[FAIL] missing JUDGMENT-FOCUS-DENSITY-BUDGET.md");
  process.exit(1);
}
const strip = fs.readFileSync(
  path.join(root, "client", "src", "pages", "judgment", "widgets", "JudgmentFocusStrip.tsx"),
  "utf-8",
);
if (strip.includes("Collapsible")) {
  console.error("[FAIL] focus strip should not use Collapsible (minimality v12)");
  process.exit(1);
}
console.log("[PASS] verify-batch100_1 judgment-focus-minimality-v12");
