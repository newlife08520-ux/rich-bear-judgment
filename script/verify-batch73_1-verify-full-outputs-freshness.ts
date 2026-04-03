/**
 * 封 ZIP 後：manifest 之 zipName 須與磁碟上實際檔案一致，且 verified log 尾段含同輪 zipName。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs", "REVIEW-PACK-MANIFEST.json");
const verifiedPath = path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "create-review-zip-verified.txt");

if (!fs.existsSync(manifestPath)) {
  console.error("[FAIL] 缺少 docs/REVIEW-PACK-MANIFEST.json");
  process.exit(1);
}
const man = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { zipName?: string };
const zipName = man.zipName?.trim();
if (!zipName || !/^phase-.+\.zip$/i.test(zipName)) {
  console.error("[FAIL] manifest.zipName 無效:", zipName);
  process.exit(1);
}
const zipAbs = path.join(root, zipName);
if (!fs.existsSync(zipAbs)) {
  console.error("[FAIL] manifest 所指 ZIP 不存在:", zipName);
  process.exit(1);
}
if (!fs.existsSync(verifiedPath)) {
  console.error("[FAIL] 缺少 create-review-zip-verified.txt");
  process.exit(1);
}
const vtext = fs.readFileSync(verifiedPath, "utf-8");
if (!vtext.includes(zipName)) {
  console.error("[FAIL] verified log 未含當輪 zipName:", zipName);
  process.exit(1);
}
const needLogs = [
  path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "01-verify-product-restructure.log.txt"),
  path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "02-verify-release-candidate.log.txt"),
];
for (const lp of needLogs) {
  if (!fs.existsSync(lp)) {
    console.error("[FAIL] 缺少", path.relative(root, lp));
    process.exit(1);
  }
}
console.log("[PASS] verify-batch73_1 verify-full-outputs-freshness:", zipName);
