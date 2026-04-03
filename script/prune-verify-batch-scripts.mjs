#!/usr/bin/env node
/**
 * 移除 package.json 內所有引用 verify-batch / verify:batch 的 scripts（封存後避免 npm 指向缺檔）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const scripts = { ...(pkg.scripts || {}) };
const before = Object.keys(scripts).length;
const re = /verify-batch|verify:batch/;

for (const k of Object.keys(scripts)) {
  if (re.test(String(scripts[k]))) delete scripts[k];
}
pkg.scripts = scripts;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
console.log("[prune-verify-batch-scripts] scripts:", before, "->", Object.keys(scripts).length);
