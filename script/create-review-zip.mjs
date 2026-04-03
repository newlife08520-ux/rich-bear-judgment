#!/usr/bin/env node
/**
 * 審查包：allowlist + fflate zipSync（entry 一律 /，不依賴 Windows Compress-Archive）。
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { zipSync } from "fflate";
import {
  listCompletionReportPaths,
  detectLatestPhaseLabel,
} from "./lib/completion-reports.mjs";
import { REVIEW_PACK_GENERATOR_VERSION } from "./lib/review-pack-generator-version.mjs";
import {
  REQUIRED_REVIEW_MATERIAL_DIR_PREFIXES,
  REQUIRED_REVIEW_MATERIAL_FILES,
} from "./lib/review-pack-required-materials.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ALLOW_DIRS = ["client", "server", "shared", "script", "docs", ".agents", "prisma"];
const ALLOW_FILES = [
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "AGENTS.md",
  "components.json",
];
const ALLOW_GLOBS = [
  "tsconfig*.json",
  "vite.config.*",
  "tailwind.config.*",
  "postcss.config.*",
  "drizzle.config.*",
  "prisma.config.*",
];

const EXCLUDE_NAMES = new Set(
  [
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".git",
    ".data",
    ".local",
    ".config",
    "attached_assets",
    "uploads",
    ".env",
    "_review_zip_temp",
    "_zip_temp",
  ].map((s) => s.toLowerCase())
);

const FORBIDDEN_PATTERNS = [
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /service[-_]?account.*\.json$/i,
  /\.db$/i,
  /pasted.*key/i,
  /plenary.*\.txt$/i,
];

function matchGlob(name, patterns) {
  return patterns.some((p) => {
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -2);
      return name === prefix || name.startsWith(prefix + ".");
    }
    if (p.includes("*")) {
      const re = new RegExp("^" + p.replace(/\*/g, ".*") + "$");
      return re.test(name);
    }
    return name === p;
  });
}

function isForbidden(filePath) {
  const base = path.basename(filePath);
  const lower = filePath.toLowerCase();
  return FORBIDDEN_PATTERNS.some((re) => re.test(base) || re.test(lower));
}

/** @type {Record<string, Uint8Array>} */
const zipFiles = {};

function addFile(relPosix, absPath) {
  if (relPosix.includes("\\") || relPosix.startsWith("/")) {
    throw new Error(`[create-review-zip] 非法 ZIP 路徑: ${relPosix}`);
  }
  zipFiles[relPosix] = new Uint8Array(fs.readFileSync(absPath));
}

function walkAdd(srcAbs, relPrefix) {
  const stat = fs.statSync(srcAbs);
  if (stat.isFile()) {
    if (isForbidden(srcAbs)) return;
    addFile(relPrefix.replace(/\\/g, "/"), srcAbs);
    return;
  }
  if (!stat.isDirectory()) return;
  const base = path.basename(srcAbs);
  if (EXCLUDE_NAMES.has(base.toLowerCase())) return;
  for (const entry of fs.readdirSync(srcAbs, { withFileTypes: true })) {
    if (EXCLUDE_NAMES.has(entry.name.toLowerCase())) continue;
    const s = path.join(srcAbs, entry.name);
    const r = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walkAdd(s, r);
    } else {
      if (isForbidden(s)) continue;
      addFile(r.replace(/\\/g, "/"), s);
    }
  }
}

function main() {
  const now = new Date();
  const stamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0");
  const phaseLabel =
    process.argv[2] ||
    process.env.REVIEW_ZIP_LABEL ||
    detectLatestPhaseLabel(root);
  const zipName = `${phaseLabel}-${stamp}.zip`;

  /** 審查包 canonical：在封 ZIP 前把本輪 zipName 寫入磁碟上的 verified log（僅當首行 exit=0），避免 ZIP 內為 wrap 前的舊 log。 */
  const verifiedAbs = path.join(root, "docs", "VERIFY-FULL-OUTPUTS", "create-review-zip-verified.txt");
  if (fs.existsSync(verifiedAbs)) {
    let vtext = fs.readFileSync(verifiedAbs, "utf-8");
    const first = vtext.split(/\r?\n/)[0]?.trim() ?? "";
    if (first === "exit=0") {
      vtext = vtext.replace(/\r?\n--- packaged review zip \(canonical\) ---\r?\nphase-[^\r\n]+\.zip\r?\n?/g, "");
      vtext = vtext.trimEnd() + `\n--- packaged review zip (canonical) ---\n${zipName}\n`;
      fs.writeFileSync(verifiedAbs, vtext, "utf-8");
    }
  }

  for (const dir of ALLOW_DIRS) {
    const src = path.join(root, dir);
    if (!fs.existsSync(src)) continue;
    walkAdd(src, dir);
  }

  /** 本機封存：completion 報告等（_agent_batch_archives 已 .gitignore，僅併入 ZIP 路徑 docs/…） */
  const archDocs = path.join(root, "_agent_batch_archives", "docs");
  if (fs.existsSync(archDocs)) {
    walkAdd(archDocs, "docs");
  }

  for (const file of ALLOW_FILES) {
    const src = path.join(root, file);
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
    if (isForbidden(src)) continue;
    addFile(file, src);
  }

  const rootFiles = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of rootFiles) {
    if (!entry.isFile()) continue;
    if (matchGlob(entry.name, ALLOW_GLOBS)) {
      const src = path.join(root, entry.name);
      if (isForbidden(src)) continue;
      addFile(entry.name, src);
    }
  }

  const requiredReports = listCompletionReportPaths(root);
  if (requiredReports.length === 0) {
    console.error("[create-review-zip] docs/ 內需至少一個 BATCH*-COMPLETION-REPORT.md");
    process.exit(1);
  }
  for (const required of requiredReports) {
    if (!zipFiles[required]) {
      console.error(`[create-review-zip] 缺少 ${required}`);
      process.exit(1);
    }
  }

  for (const f of REQUIRED_REVIEW_MATERIAL_FILES) {
    if (!zipFiles[f]) {
      console.error(`[create-review-zip] 審查材料缺漏（須存在於 docs/）：${f}`);
      process.exit(1);
    }
  }
  for (const prefix of REQUIRED_REVIEW_MATERIAL_DIR_PREFIXES) {
    const ok = Object.keys(zipFiles).some((k) => k.startsWith(prefix) && !k.endsWith("/"));
    if (!ok) {
      console.error(`[create-review-zip] 審查材料目錄須至少一個檔案：${prefix}`);
      process.exit(1);
    }
  }

  const CONTENTS_KEY = "docs/REVIEW-PACK-CONTENTS.json";
  const MANIFEST_KEY = "docs/REVIEW-PACK-MANIFEST.json";
  const contentsBase = {
    phaseLabel,
    createdAt: now.toISOString(),
    completionReports: requiredReports,
    generatorVersion: REVIEW_PACK_GENERATOR_VERSION,
    note: "ZIP includes docs/REVIEW-PACK-CONTENTS.json and docs/REVIEW-PACK-MANIFEST.json",
  };

  /** payloadSha256：ZIP entries 排序後逐條 hash（排除 manifest 自身），語意為「內容」hash，非 ZIP 檔 hash */
  function computePayloadSha256(files, excludeKey) {
    const h = createHash("sha256");
    for (const key of Object.keys(files).sort()) {
      if (key === excludeKey) continue;
      const buf = Buffer.from(files[key]);
      h.update(key);
      h.update("\0", "utf-8");
      h.update(buf);
      h.update("\0", "utf-8");
    }
    return h.digest("hex");
  }

  /** 與 unzip keys.length 一致：先佔位兩 JSON，再以實際 key 數回填 entryCount 與 payloadSha256 */
  zipFiles[CONTENTS_KEY] = new Uint8Array(
    Buffer.from(JSON.stringify({ ...contentsBase, entryCount: 0 }, null, 2) + "\n", "utf-8")
  );
  const zipPathRel = path.relative(root, path.join(root, zipName)).split(path.sep).join("/");
  zipFiles[MANIFEST_KEY] = new Uint8Array(
    Buffer.from(
      JSON.stringify(
        {
          zipName,
          zipPath: zipPathRel,
          phaseLabel,
          createdAt: now.toISOString(),
          entryCount: 0,
          completionReports: requiredReports,
          payloadSha256: "pending",
          contentsNote: "payloadSha256 = hash of ZIP entries excluding this manifest; see .sha256 sidecar for ZIP file digest",
        },
        null,
        2
      ) + "\n",
      "utf-8"
    )
  );
  const accurateEntryCount = Object.keys(zipFiles).length;
  zipFiles[CONTENTS_KEY] = new Uint8Array(
    Buffer.from(JSON.stringify({ ...contentsBase, entryCount: accurateEntryCount }, null, 2) + "\n", "utf-8")
  );
  const payloadSha256 = computePayloadSha256(zipFiles, MANIFEST_KEY);

  function buildManifestPayload() {
    return {
      zipName,
      zipPath: zipPathRel,
      phaseLabel,
      createdAt: now.toISOString(),
      entryCount: accurateEntryCount,
      completionReports: requiredReports,
      payloadSha256,
      contentsNote: "payloadSha256 = hash of ZIP entries excluding this manifest; see .sha256 sidecar for ZIP file digest",
    };
  }

  const finalManifest = buildManifestPayload();
  zipFiles[MANIFEST_KEY] = new Uint8Array(
    Buffer.from(JSON.stringify(finalManifest, null, 2) + "\n", "utf-8")
  );
  const MAX_BYTES = 500 * 1024 * 1024;
  const zipped = zipSync(zipFiles, { level: 6 });
  const buf = Buffer.from(zipped);

  function writeRawZipOnly(name, bytes) {
    const zipPath = path.join(root, name);
    fs.writeFileSync(zipPath, bytes);
    const realZipSha256 = createHash("sha256").update(bytes).digest("hex");
    const sidecarPath = path.join(root, `${name}.sha256`);
    fs.writeFileSync(sidecarPath, realZipSha256 + "\n", "utf-8");
    console.log("[create-review-zip] Created:", zipPath, "size_mb:", (bytes.length / (1024 * 1024)).toFixed(2));
    console.log("[create-review-zip] ZIP file digest:", sidecarPath, ":", realZipSha256);
    return realZipSha256;
  }

  if (buf.length <= MAX_BYTES) {
    const zipPath = path.join(root, zipName);
    fs.writeFileSync(zipPath, buf);
    const realZipSha256 = createHash("sha256").update(buf).digest("hex");
    const sidecarPath = path.join(root, `${zipName}.sha256`);
    fs.writeFileSync(sidecarPath, realZipSha256 + "\n", "utf-8");
    const manifestPath = path.join(root, "docs", "REVIEW-PACK-MANIFEST.json");
    fs.writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2) + "\n");
    const contentsDiskPath = path.join(root, "docs", "REVIEW-PACK-CONTENTS.json");
    fs.writeFileSync(
      contentsDiskPath,
      JSON.stringify({ ...contentsBase, entryCount: accurateEntryCount }, null, 2) + "\n"
    );
    console.log("[create-review-zip] Created:", zipPath, "entries:", Object.keys(zipFiles).length);
    console.log("[create-review-zip] payloadSha256 (contents):", payloadSha256);
    console.log("[create-review-zip] ZIP file digest:", sidecarPath, ":", realZipSha256);
    return;
  }

  console.warn("[create-review-zip] ZIP exceeds 500MB; splitting part1/part2 (deterministic).");
  const part1Files = {};
  const part2Files = {};
  for (const k of Object.keys(zipFiles)) {
    if (k.startsWith("client/") || k.startsWith("server/")) part2Files[k] = zipFiles[k];
    else part1Files[k] = zipFiles[k];
  }
  const baseName = zipName.replace(/\.zip$/, "");
  const name1 = `${baseName}-part1.zip`;
  const name2 = `${baseName}-part2.zip`;
  const z1 = zipSync(part1Files, { level: 6 });
  const z2 = zipSync(part2Files, { level: 6 });
  const b1 = Buffer.from(z1);
  const b2 = Buffer.from(z2);
  const sha1 = writeRawZipOnly(name1, b1);
  const sha2 = writeRawZipOnly(name2, b2);
  const splitManifest = {
    split: true,
    part1: { zipName: name1, entryCount: Object.keys(part1Files).length, sha256: sha1 },
    part2: { zipName: name2, entryCount: Object.keys(part2Files).length, sha256: sha2 },
    phaseLabel,
    createdAt: now.toISOString(),
    completionReports: requiredReports,
    payloadSha256,
    contentsNote: "Split pack; see docs/REVIEW-PACK-SPLIT-README.md",
  };
  fs.writeFileSync(path.join(root, "docs", "REVIEW-PACK-MANIFEST.json"), JSON.stringify(splitManifest, null, 2) + "\n");
  const splitReadme = `# Review pack split (>500MB rule)

- **Part 1** (${name1}): docs, prisma, script, shared, root configs, .agents — audit reports, verify outputs, schema.
- **Part 2** (${name2}): client, server — application source.

SHA256 part1: ${sha1}
SHA256 part2: ${sha2}

Reassemble: read Part 1 first for manifests and BATCH completion reports, then Part 2 for code.
`;
  fs.writeFileSync(path.join(root, "docs", "REVIEW-PACK-SPLIT-README.md"), splitReadme, "utf-8");
  console.log("[create-review-zip] Wrote docs/REVIEW-PACK-SPLIT-README.md");
  console.log("[create-review-zip] payloadSha256 (full tree before split):", payloadSha256);
}

main();
