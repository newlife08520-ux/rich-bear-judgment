/**
 * ZIP 內 docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt 首行 exit=0。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { unzipSync } from "fflate";
import { resolveReviewZipPath } from "./lib/resolve-review-zip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipPath = resolveReviewZipPath(root, process.argv.slice(2));
const buf = fs.readFileSync(zipPath);
const files = unzipSync(new Uint8Array(buf));
const key = "docs/VERIFY-FULL-OUTPUTS/create-review-zip-verified.txt";
const u8 = files[key];
if (!u8) {
  console.error("[FAIL] ZIP 缺少", key);
  process.exit(1);
}
const text = Buffer.from(u8).toString("utf-8");
const first = text.split(/\r?\n/)[0]?.trim() ?? "";
if (first !== "exit=0") {
  console.error("[FAIL] ZIP 內 verified 首行須為 exit=0，實際:", first);
  process.exit(1);
}
console.log("[PASS] verify-batch78 zip-inner-verified-line");
