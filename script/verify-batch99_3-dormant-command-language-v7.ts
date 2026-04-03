import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "docs", "active", "DORMANT-GEM-COMMAND-LANGUAGE.md");
if (!fs.existsSync(p)) {
  console.error("[FAIL] missing DORMANT-GEM-COMMAND-LANGUAGE.md");
  process.exit(1);
}
const t = fs.readFileSync(p, "utf-8");
if (!t.includes("復活") || !t.includes("停駐") || !t.includes("診斷")) {
  console.error("[FAIL] command language doc should cover revive / parked / diagnose (ZH)");
  process.exit(1);
}
console.log("[PASS] verify-batch99_3 dormant-command-language-v7");
