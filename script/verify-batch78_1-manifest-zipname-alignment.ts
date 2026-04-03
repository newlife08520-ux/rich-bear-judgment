/**
 * 磁碟 manifest.zipName 與 verified log「packaged」段落一致。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const man = JSON.parse(fs.readFileSync(path.join(root, "docs", "REVIEW-PACK-MANIFEST.json"), "utf-8")) as {
  zipName?: string;
};
const zipName = man.zipName?.trim();
const vpath = path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "create-review-zip-verified.txt");
const v = fs.readFileSync(vpath, "utf-8");
const m = v.match(/--- packaged review zip \(canonical\) ---\s*\r?\n([^\r\n]+)/);
const fromLog = m?.[1]?.trim();
if (!zipName || zipName !== fromLog) {
  console.error("[FAIL] manifest.zipName 與 verified packaged 行不一致", { zipName, fromLog });
  process.exit(1);
}
console.log("[PASS] verify-batch78_1 manifest-zipname-alignment:", zipName);
