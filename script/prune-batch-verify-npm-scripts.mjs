#!/usr/bin/env node
/**
 * 移除 package.json 內所有依賴 script/verify-batch*.ts 或 npm run verify:batch* 的 scripts，
 * 並保留 create-review-zip（若缺則補上）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const scripts = pkg.scripts ?? {};
const next = {};
const bad = /script\/verify-batch|script\\verify-batch|verify:batch/;
for (const [k, v] of Object.entries(scripts)) {
  if (bad.test(String(v))) continue;
  next[k] = v;
}
if (!next["create-review-zip"]) {
  next["create-review-zip"] = "node script/create-review-zip.mjs";
}
pkg.scripts = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
console.log("[prune-batch-verify-npm-scripts] remaining script keys:", Object.keys(next).length);
