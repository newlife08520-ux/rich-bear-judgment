#!/usr/bin/env node
/**
 * Batch 11.7：審查包 canonical 順序
 * 1) inner:prep（不含 ZIP）
 * 2) 寫入 create-review-zip-verified.txt（exit + 完整 prep log）
 * 3) batch68 → batch73（prep 鏈語意；不含舊 ZIP 內 log）
 * 4) create-review-zip.mjs（封 ZIP 前會把 zipName 附入 verified 檔再 walk）
 * 5) batch73_1（zip 與 verified、manifest 時序一致）
 * 6) inner:postZip（含 batch78 / batch78_1 查 ZIP 內檔）
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
const outPath = path.join(outDir, "create-review-zip-verified.txt");

function runPrepSync() {
  /** spawnSync 在 Windows 上較能穩定收到 npm 的 stdout/stderr（async spawn 曾寫出空 log，batch68/73 失敗） */
  const r = spawnSync(npm, ["run", "create-review-zip:verified:inner:prep"], {
    cwd: root,
    shell: true,
    env: { ...process.env, FORCE_COLOR: "0" },
    encoding: "utf-8",
    maxBuffer: 80 * 1024 * 1024,
  });
  const logText = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const code = r.status === null ? 1 : r.status;
  return { code, logText };
}

async function main() {
  let code = 1;
  let streamBody = "";
  try {
    const r = runPrepSync();
    code = r.code;
    streamBody = r.logText;
  } catch (e) {
    console.error("[wrap-create-review-zip-verified]", e);
    code = 1;
    streamBody = String(e);
  }

  const text = `exit=${code}\n--- combined log ---\n${streamBody}\n`;
  fs.writeFileSync(outPath, text, "utf-8");
  console.log("[wrap-create-review-zip-verified] wrote", outPath, "exit", code);

  if (code !== 0) {
    process.exit(code);
  }

  function runVerify(script) {
    const v = spawnSync(npm, ["run", script], {
      cwd: root,
      shell: true,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (v.stdout) process.stdout.write(v.stdout);
    if (v.stderr) process.stderr.write(v.stderr);
    return v.status === null ? 1 : v.status;
  }

  function runNode(scriptRel, extraArgs = []) {
    const node = process.execPath;
    const v = spawnSync(node, [path.join(root, scriptRel), ...extraArgs], {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 80 * 1024 * 1024,
    });
    if (v.stdout) process.stdout.write(v.stdout);
    if (v.stderr) process.stderr.write(v.stderr);
    return v.status === null ? 1 : v.status;
  }

  let st = runVerify("verify:batch68:release-chain-integrity");
  if (st !== 0) process.exit(st);
  st = runVerify("verify:batch73:canonical-create-review-zip-exit0");
  if (st !== 0) process.exit(st);

  st = runNode("script/create-review-zip.mjs");
  if (st !== 0) process.exit(st);

  st = runVerify("verify:batch73_1:verify-full-outputs-freshness");
  if (st !== 0) process.exit(st);

  st = runVerify("create-review-zip:verified:inner:postZip");
  process.exit(st);
}

main();
