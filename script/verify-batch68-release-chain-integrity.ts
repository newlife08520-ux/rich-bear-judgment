/**
 * 審查鏈：package.json 必含 canonical 交付腳本（Batch 15.3）。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as { scripts: Record<string, string> };
const s = pkg.scripts;
const need = [
  "verify:ui-core",
  "verify:intelligence",
  "verify:reviewer-trust",
  "verify:ops",
  "verify:review-pack-contracts",
  "verify:review-pack",
  "verify:full",
  "verify:product-restructure",
  "verify:release-candidate",
  "verify:wave:legacy-umbrella",
  "create-review-zip:verified",
  "create-review-zip:verified:inner:prep",
  "create-review-zip:verified:inner:postZip",
];
let bad = 0;
for (const k of need) {
  if (!s[k]) {
    console.error("[FAIL] package.json scripts 缺少:", k);
    bad++;
  }
}
if (bad) process.exit(1);
console.log("[PASS] verify-batch68 release-chain-integrity:", need.length, "keys present");
