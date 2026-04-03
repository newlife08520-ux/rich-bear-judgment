/**
 * inner:prep 後之 canonical log 首行須為 exit=0（Batch 11.7 語意延續）。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "create-review-zip-verified.txt");
if (!fs.existsSync(p)) {
  console.error("[FAIL] 缺少 docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt（請先跑 inner:prep）");
  process.exit(1);
}
const first = fs.readFileSync(p, "utf-8").split(/\r?\n/)[0]?.trim() ?? "";
if (first !== "exit=0") {
  console.error("[FAIL] canonical log 首行須為 exit=0，實際:", first);
  process.exit(1);
}
console.log("[PASS] verify-batch73 canonical-create-review-zip-exit0");
