#!/usr/bin/env node
/**
 * 將關鍵 verify / check 輸出寫入 docs/verify-outputs/（供審查包閱讀）。
 * 執行：npm run capture:verify-outputs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "verify-outputs");
fs.mkdirSync(outDir, { recursive: true });

function run(label, args) {
  const log = path.join(outDir, `${label}.txt`);
  const r = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf-8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  const text = `exit=${r.status}\n--- stdout ---\n${r.stdout || ""}\n--- stderr ---\n${r.stderr || ""}\n`;
  fs.writeFileSync(log, text, "utf-8");
  console.log("[capture]", label, "->", log, "exit", r.status);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
run("npm-run-check", [npm, "run", "check"]);
run("verify-batch6_4-6_8-intelligence-suite", [npm, "run", "verify:batch6_4-6_8:intelligence-suite"]);
run("verify-batch6_9-7_2-intelligence-plus", [npm, "run", "verify:batch6_9-7_2:intelligence-plus"]);
run("verify-batch7_3-7_6-umbrella", [npm, "run", "verify:batch7_3-7_6:umbrella"]);
run("verify-product-restructure", [npm, "run", "verify:product-restructure"]);
console.log("[capture-verify-outputs] Done. See docs/verify-outputs/");
