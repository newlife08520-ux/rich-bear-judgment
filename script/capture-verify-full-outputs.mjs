#!/usr/bin/env node
/**
 * 寫入 docs/VERIFY-FULL-OUTPUTS/ 供審查包對照（Batch 8.3–8.6）。
 * 由 create-review-zip:verified 在 release-candidate 之後呼叫。
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "VERIFY-FULL-OUTPUTS");
fs.mkdirSync(outDir, { recursive: true });

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(label, args) {
  const log = path.join(outDir, `${label}.log.txt`);
  const r = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf-8",
    shell: true,
    maxBuffer: 40 * 1024 * 1024,
  });
  const text = `exit=${r.status}\n--- stdout ---\n${r.stdout || ""}\n--- stderr ---\n${r.stderr || ""}\n`;
  fs.writeFileSync(log, text, "utf-8");
  if (label === "01-verify-product-restructure") {
    fs.writeFileSync(path.join(outDir, "verify-product-restructure.txt"), text, "utf-8");
  }
  if (label === "02-verify-release-candidate") {
    fs.writeFileSync(path.join(outDir, "verify-release-candidate.txt"), text, "utf-8");
  }
  console.log("[capture-verify-full-outputs]", label, "->", log, "exit", r.status);
  if (r.status !== 0) {
    console.error("[FAIL]", label, "non-zero exit");
    process.exit(r.status ?? 1);
  }
}

run("01-verify-product-restructure", [npm, "run", "verify:product-restructure"]);
run("02-verify-release-candidate", [npm, "run", "verify:release-candidate"]);

fs.writeFileSync(
  path.join(outDir, "03-create-review-zip-verified.tail-note.txt"),
  [
    "Note: create-review-zip:verified continues after this capture with:",
    "wrap: batch68 → batch73 → create-review-zip.mjs → batch73_1 → inner:postZip (batch78, batch78_1, verify:review-zip-hygiene).",
    "Canonical chain: verify:release-candidate = core-regression + product-restructure + ops + reviewer-trust (see docs/active/VERIFY-CHAIN-CANONICAL-MAP.md).",
    "See parent npm log for full tail if needed.",
    "",
  ].join("\n"),
  "utf-8"
);

const readme = `# VERIFY-FULL-OUTPUTS

- 01-verify-product-restructure.log.txt + **verify-product-restructure.txt**（同內容別名）
- 02-verify-release-candidate.log.txt + **verify-release-candidate.txt**
- **create-review-zip-verified.txt**（wrap 腳本寫入之完整 inner 鏈 stdout/stderr）
- 03-create-review-zip-verified.tail-note.txt（ZIP 鏈後半說明）

完整 npm run create-review-zip:verified 請併看 **create-review-zip-verified.txt** 或終端機 log。
`;
fs.writeFileSync(path.join(outDir, "README.md"), readme, "utf-8");
console.log("[capture-verify-full-outputs] Done");
