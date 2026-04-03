import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const j = fs.readFileSync(
  path.join(root, "client", "src", "pages", "judgment", "widgets", "JudgmentFocusStrip.tsx"),
  "utf-8",
);
if (!j.includes("judgment-focus-strip-v12") || !j.includes("judgment-focus-evidence-single-v12")) {
  console.error("[FAIL] JudgmentFocusStrip v12 testids");
  process.exit(1);
}
const ia = path.join(root, "docs", "active", "JUDGMENT-FOCUS-V12-IA.md");
if (!fs.existsSync(ia)) {
  console.error("[FAIL] missing JUDGMENT-FOCUS-V12-IA.md");
  process.exit(1);
}
console.log("[PASS] verify-batch100 judgment-focus-v12");
