/**
 * 審查包衛生：1) 打包腳本規則 2) 實際檢查最新 phase-batch*.zip 的 entries（含 \\ 與 BATCH3.0 報告）。
 */
import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import * as os from "os";
import { unzipSync } from "fflate";
import { listCompletionReportRelPaths } from "./lib/completion-reports";
import { resolveReviewZipPath } from "./lib/resolve-review-zip";

const root = path.join(process.cwd());
const scriptDir = path.join(root, "script");

let failed = 0;

const zipScript = path.join(scriptDir, "create-review-zip.mjs");
if (!fs.existsSync(zipScript)) {
  console.error("[FAIL] script/create-review-zip.mjs 不存在");
  failed++;
} else {
  console.log("[PASS] 打包腳本 create-review-zip.mjs 存在");
}

const content = fs.existsSync(zipScript) ? fs.readFileSync(zipScript, "utf-8") : "";
const requiredDirs = ["client", "server", "script", "docs", ".agents", "prisma"];
for (const d of requiredDirs) {
  if (!content.includes(d)) {
    console.error(`[FAIL] 打包腳本 allowlist 應包含目錄：${d}`);
    failed++;
  }
}
if (requiredDirs.every((d) => content.includes(d))) {
  console.log("[PASS] allowlist 含 client / server / script / docs / .agents / prisma");
}

const forbiddenInScript = [".data", ".local", ".config", "attached_assets", "node_modules", "dist", "build", ".git", "coverage", ".env"];
for (const name of forbiddenInScript) {
  if (!content.includes(name)) {
    console.error(`[FAIL] 打包腳本應排除：${name}`);
    failed++;
  }
}
if (forbiddenInScript.every((name) => content.includes(name))) {
  console.log("[PASS] 腳本排除清單含暫存／敏感目錄");
}

const credentialOk =
  content.toLowerCase().includes(".pem") &&
  content.toLowerCase().includes(".key") &&
  content.toLowerCase().includes("service");
if (!credentialOk) {
  console.error("[FAIL] 打包腳本應含憑證過濾（.pem、.key、service 等）");
  failed++;
} else {
  console.log("[PASS] 打包腳本含憑證／敏感檔過濾邏輯");
}

const zipUsesPhaseLabel =
  content.includes("REVIEW_ZIP_LABEL") ||
  content.includes("process.argv[2]") ||
  content.includes("phaseLabel");
if (!zipUsesPhaseLabel || content.includes("phase-batch2_8-complete-")) {
  console.error(
    "[FAIL] create-review-zip 應以 phase label 命名（argv／REVIEW_ZIP_LABEL／phaseLabel），且預設不應寫死 phase-batch2_8"
  );
  failed++;
} else {
  console.log("[PASS] ZIP 檔名支援 phase label");
}

if (failed > 0) {
  console.error("\n[verify-review-zip-hygiene] 腳本檢查未通過");
  process.exit(1);
}

/** 用 fflate 讀取 ZIP，取得 raw entry 名稱（可偵測 \\） */
function listZipEntriesRaw(zipPath: string): string[] {
  const buf = fs.readFileSync(zipPath);
  const files = unzipSync(new Uint8Array(buf));
  return Object.keys(files).filter((k) => !k.endsWith("/"));
}

function listZipEntries(zipPath: string): string[] {
  const abs = path.resolve(zipPath);
  const tar = spawnSync("tar", ["-tf", abs], { encoding: "utf-8", maxBuffer: 80 * 1024 * 1024 });
  if (tar.status === 0 && (tar.stdout || "").trim().length > 0) {
    return (tar.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\\/g, "/"))
      .filter(Boolean);
  }
  const unzip = spawnSync("unzip", ["-Z1", abs], { encoding: "utf-8", maxBuffer: 80 * 1024 * 1024 });
  if (unzip.status === 0 && (unzip.stdout || "").trim().length > 0) {
    return (unzip.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.replace(/\\/g, "/"))
      .filter(Boolean);
  }
  const ps1 = path.join(os.tmpdir(), `zip-entries-${Date.now()}.ps1`);
  const psBody = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead([System.IO.Path]::GetFullPath('${abs.replace(/'/g, "''")}'))
try {
  foreach ($e in $z.Entries) { [Console]::Out.WriteLine($e.FullName) }
} finally { $z.Dispose() }
`;
  fs.writeFileSync(ps1, psBody, "utf-8");
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], {
    encoding: "utf-8",
    maxBuffer: 80 * 1024 * 1024,
  });
  try {
    fs.unlinkSync(ps1);
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    throw new Error(r.stderr || "無法列出 ZIP（tar / unzip / powershell 皆失敗）");
  }
  return (r.stdout || "")
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\\/g, "/"))
    .filter(Boolean);
}

let zipPath: string;
try {
  zipPath = resolveReviewZipPath(root, process.argv.slice(2));
  console.log("[INFO] 審查 ZIP:", zipPath);
} catch {
  console.log("[INFO] 無法由 --zip / REVIEW_ZIP_PATH / manifest 解析，執行 create-review-zip…");
  execSync("node script/create-review-zip.mjs", { cwd: root, stdio: "inherit" });
  zipPath = resolveReviewZipPath(root, process.argv.slice(2));
}
const zipName = path.basename(zipPath);
let rawEntries: string[];
try {
  rawEntries = listZipEntriesRaw(zipPath);
} catch (e) {
  console.error("[FAIL] 無法讀取 ZIP entries（fflate）:", e instanceof Error ? e.message : e);
  process.exit(1);
}
if (rawEntries.some((e) => e.includes("\\"))) {
  console.error("[FAIL] ZIP entries 不應含 Windows 反斜線，需以 / 作為路徑分隔");
  process.exit(1);
}
console.log("[PASS] ZIP entries 全部使用 forward slash");

const entries = rawEntries.map((e) => e.replace(/\\/g, "/"));
const requiredReports = listCompletionReportRelPaths(root);
if (requiredReports.length === 0) {
  console.error("[FAIL] docs/ 內需至少一個 BATCH*-COMPLETION-REPORT.md");
  process.exit(1);
}
for (const requiredReport of requiredReports) {
  if (!entries.includes(requiredReport)) {
    console.error(`[FAIL] 缺少 ${requiredReport}`);
    process.exit(1);
  }
  console.log(`[PASS] 含 ${requiredReport}`);
}

if (!entries.includes("docs/REVIEW-PACK-CONTENTS.json")) {
  console.error("[FAIL] ZIP 應含 docs/REVIEW-PACK-CONTENTS.json（Batch 3.4+）");
  process.exit(1);
}
console.log("[PASS] 含 docs/REVIEW-PACK-CONTENTS.json");

/** 與 script/lib/review-pack-required-materials.mjs 同步 */
const REQUIRED_REVIEW_MATERIAL_DIR_PREFIXES = [
  "docs/PAGE-STATE-SCREENSHOTS/",
  "docs/RUNTIME-QUERY-CAPTURES/",
  "docs/LIVE-RUNTIME-CAPTURES/",
  "docs/SANITIZED-DB-SNAPSHOTS/",
  "docs/VERIFY-FULL-OUTPUTS/",
];
const REQUIRED_REVIEW_MATERIAL_FILES = [
  "docs/SCREENSHOT-TO-DATA-MAP.md",
  "docs/UI-TRUTH-MAPPING.md",
  "docs/API-SAMPLE-PAYLOADS.md",
  "docs/OPEN-ISSUES-AND-BLOCKERS.md",
  "docs/DELETE-CANDIDATES.md",
  "docs/active/VERIFY-CHAIN-CANONICAL-MAP-v2.md",
  "docs/active/TIER-D-DIRTY-ACCOUNT-PACK.md",
  "docs/active/EXECUTION-AUDIT-SURFACE.md",
  "docs/active/META-ERROR-HANDLING-RUNBOOK.md",
  "docs/active/DATA-TRUTH-STATE-MACHINE.md",
  "docs/active/PUBLISH-MVP-CLOSURE.md",
  "docs/active/OUT-OF-BAND-SYNC-DESIGN.md",
  "docs/active/PUBLISH-LIMITATIONS-AND-SAFETY.md",
  "docs/active/EXECUTION-ACCOUNTABILITY-RULES.md",
  "docs/active/ACTIONABLE-ERROR-UX-MATRIX.md",
  "docs/active/PARTIAL-VS-NO-DATA-PLAYBOOK.md",
  "docs/active/TIER-D-COVERAGE-MATRIX.md",
  "docs/active/CI-STATISTICAL-LIMITATIONS.md",
  "docs/active/VERIFY-CHAIN-MIGRATION-NOTES-v2.md",
  "docs/active/GEMINI-RECONCILIATION-BATCH16.2.md",
  "docs/active/PUBLISH-MVP-CLOSURE-v2.md",
  "docs/active/PUBLISH-REALITY-CHECK.md",
  "docs/active/OUT-OF-BAND-SYNC-DESIGN-v2.md",
  "docs/active/EXTERNAL-META-CHANGE-POLICY-v2.md",
  "docs/active/EXECUTION-AUDIT-SURFACE-v2.md",
  "docs/active/META-ERROR-HANDLING-RUNBOOK-v2.md",
  "docs/active/ACTIONABLE-ERROR-UX-MATRIX-v2.md",
  "docs/active/DATA-TRUTH-STATE-MACHINE-v2.md",
  "docs/active/PARTIAL-VS-NO-DATA-PLAYBOOK-v2.md",
  "docs/active/TRUTH-PACK-TIER-MODEL-v3.md",
  "docs/active/STAGING-CAPTURE-CONTRACT-v2.md",
  "docs/active/PROD-SANITIZATION-CONTRACT-v2.md",
  "docs/active/TIER-D-DIRTY-ACCOUNT-PACK-v2.md",
  "docs/active/TIER-D-COVERAGE-MATRIX-v2.md",
  "docs/active/ROUTES-SPLIT-PROGRESS-B.md",
  "docs/active/SCHEMA-SPLIT-PROGRESS-B.md",
  "docs/active/STRATEGIC-UI-POLISH-v1.md",
  "docs/active/HOMEPAGE-HIERARCHY-vNext.md",
  "docs/active/JUDGMENT-FOCUS-MINIMALITY-vNext.md",
  "docs/active/BATCH16.2-GEMINI-INTEGRATED-EXECUTION-COMPLETION-REPORT.md",
];
for (const f of REQUIRED_REVIEW_MATERIAL_FILES) {
  if (!entries.includes(f)) {
    console.error(`[FAIL] 審查材料缺漏：${f}`);
    process.exit(1);
  }
  console.log(`[PASS] 審查材料 ${f}`);
}
for (const prefix of REQUIRED_REVIEW_MATERIAL_DIR_PREFIXES) {
  if (!entries.some((e) => e.startsWith(prefix))) {
    console.error(`[FAIL] 審查材料目錄缺檔案：${prefix}`);
    process.exit(1);
  }
  console.log(`[PASS] 審查材料目錄 ${prefix}*`);
}
if (!entries.includes("docs/REVIEW-PACK-MANIFEST.json")) {
  console.error("[FAIL] ZIP 應含 docs/REVIEW-PACK-MANIFEST.json");
  process.exit(1);
}
console.log("[PASS] 含 docs/REVIEW-PACK-MANIFEST.json");

if (entries.length < 50) {
  console.error(`[FAIL] ZIP entries 過少（${entries.length}），可能未正確讀取或 ZIP 損毀`);
  process.exit(1);
}

const hasPrefix = (p: string) => entries.some((e) => e === p || e.startsWith(p + "/"));
const needRoots = ["client", "server", "docs", "script"];
let rootFail = 0;
for (const r of needRoots) {
  if (!hasPrefix(r)) {
    console.error(`[FAIL] ZIP 根層應含 ${r}/`);
    rootFail++;
  }
}
if (!entries.some((e) => /(^|\/)package\.json$/i.test(e))) {
  console.error("[FAIL] ZIP 應含 package.json");
  rootFail++;
}
if (rootFail === 0) {
  console.log("[PASS] ZIP 根層含 client/、server/、docs/、script/ 與 package.json");
}

const batch30Report =
  path.join(root, "docs", "archive", "BATCH3.0-COMPLETION-REPORT.md");
if (fs.existsSync(batch30Report)) {
  if (/^phase-batch2_8-complete-/i.test(zipName)) {
    console.error(
      "[FAIL] 已有 BATCH3.0 完成報告時，最新審查 ZIP 不應仍為 phase-batch2_8-complete-*（請用 create-review-zip 新 label 重打包）"
    );
    rootFail++;
  }
}

if (rootFail > 0) {
  process.exit(1);
}

function forbiddenReason(entry: string): string | null {
  const norm = entry.replace(/\\/g, "/");
  const n = norm.toLowerCase();
  const segs = n.split("/").filter(Boolean);
  if (segs.includes("node_modules")) return "node_modules";
  if (segs.includes(".git") || n.includes("/.git/") || n.endsWith("/.git")) return ".git";
  if (segs.includes("attached_assets")) return "attached_assets";
  if (segs.includes(".data") || segs.some((s) => s.startsWith(".data"))) return ".data";
  if (segs.includes(".local")) return ".local";
  if (segs.includes(".config")) return ".config";
  if (segs.includes("dist")) return "dist";
  if (segs.includes("build")) return "build";
  if (segs.includes("coverage")) return "coverage";
  if (n.includes("service account") || n.includes("serviceaccount")) return "service account";
  if (/\.db$/i.test(entry)) return "*.db";
  if (/\.pem$/i.test(entry)) return ".pem";
  const base = path.basename(entry);
  if (/\.key$/i.test(base)) return ".key";
  const baseL = base.toLowerCase();
  if (baseL === ".env" || (baseL.endsWith(".env") && !baseL.endsWith(".env.example"))) return ".env";
  return null;
}

let zipFailed = 0;
for (const entry of entries) {
  const reason = forbiddenReason(entry);
  if (reason) {
    console.error(`[FAIL] ZIP 禁止項目「${reason}」：${entry}`);
    zipFailed++;
  }
}

if (zipFailed > 0) {
  console.error(`\n[verify-review-zip-hygiene] 實際 ZIP 檢查未通過（${zipName}）`);
  process.exit(1);
}

console.log(`[PASS] 已檢查實際 ZIP entries（${zipName}，共 ${entries.length} 筆），無禁止路徑／憑證檔`);
console.log("\n[verify-review-zip-hygiene] 全部通過");
