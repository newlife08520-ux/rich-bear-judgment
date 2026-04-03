/**
 * Baseline 驗收：npm run check + npm run build，任一步失敗即 exit 1。
 * 產出：sample-data/verify-baseline-output.txt
 * 依 cursor_acceptance_gap_closure 清單 0.3 要求。
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "sample-data", "verify-baseline-output.txt");

const lines: string[] = [];
function log(msg: string) {
  lines.push(msg);
  console.log(msg);
}

function run(cmd: string, label: string): boolean {
  log(`\n--- ${label} ---`);
  log(`$ ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: root, encoding: "utf-8", maxBuffer: 4 * 1024 * 1024 });
    if (out) log(out.trim());
    log(`[OK] ${label}`);
    return true;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout) log(String(err.stdout).trim());
    if (err.stderr) log(String(err.stderr).trim());
    log(`[FAIL] ${label}: ${err.message ?? String(e)}`);
    return false;
  }
}

function main() {
  log(`verify-baseline @ ${new Date().toISOString()}`);
  log(`cwd: ${root}`);

  const checkOk = run("npm run check", "npm run check");
  if (!checkOk) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
    console.error("verify:baseline failed at npm run check");
    process.exit(1);
  }

  const buildOk = run("npm run build", "npm run build");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");

  if (!buildOk) {
    console.error("verify:baseline failed at npm run build");
    process.exit(1);
  }

  log("\n[verify:baseline] All passed (check + build).");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
  process.exit(0);
}

main();
