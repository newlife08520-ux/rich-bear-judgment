/**
 * 審查 ZIP 路徑解析：--zip → REVIEW_ZIP_PATH → docs/REVIEW-PACK-MANIFEST.json → 最新 mtime
 * 預設 phase-*.zip 須含目前 docs 內所有 BATCH*-COMPLETION-REPORT，否則視為過期並拋錯（觸發 create-review-zip）。
 */
import * as fs from "fs";
import * as path from "path";
import { unzipSync } from "fflate";
import { listCompletionReportRelPaths } from "./completion-reports";

function phaseZipContainsAllCompletionReports(root: string, zipAbs: string): boolean {
  const required = listCompletionReportRelPaths(root);
  if (required.length === 0) return false;
  try {
    const files = unzipSync(new Uint8Array(fs.readFileSync(zipAbs)));
    const entries = new Set(
      Object.keys(files)
        .filter((k) => !k.endsWith("/"))
        .map((k) => k.replace(/\\/g, "/")),
    );
    return required.every((r) => entries.has(r));
  } catch {
    return false;
  }
}

export function resolveReviewZipPath(root: string, argv: string[]): string {
  const zipArg = argv.indexOf("--zip");
  if (zipArg >= 0 && argv[zipArg + 1]) {
    const p = path.resolve(root, argv[zipArg + 1].trim());
    if (fs.existsSync(p) && p.toLowerCase().endsWith(".zip")) return p;
  }
  const env = process.env.REVIEW_ZIP_PATH?.trim();
  if (env) {
    const p = path.resolve(root, env);
    if (fs.existsSync(p) && p.toLowerCase().endsWith(".zip")) return p;
  }
  const manifestPath = path.join(root, "docs", "REVIEW-PACK-MANIFEST.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        zipPath?: string;
        zipName?: string;
      };
      const manifestCandidates: string[] = [];
      if (m.zipPath) {
        manifestCandidates.push(path.isAbsolute(m.zipPath) ? m.zipPath : path.join(root, m.zipPath));
      }
      if (m.zipName) {
        manifestCandidates.push(path.join(root, m.zipName));
      }
      for (const p of manifestCandidates) {
        if (
          fs.existsSync(p) &&
          p.toLowerCase().endsWith(".zip") &&
          phaseZipContainsAllCompletionReports(root, p)
        ) {
          return p;
        }
      }
    } catch {
      /* ignore */
    }
  }
  const names = fs.readdirSync(root).filter((f) => /^phase-.+\.zip$/i.test(f));
  if (names.length === 0) {
    throw new Error("[resolveReviewZip] 找不到 phase-*.zip；請先 create-review-zip 或設定 --zip / REVIEW_ZIP_PATH / manifest");
  }
  const sorted = names
    .map((n) => ({ n, t: fs.statSync(path.join(root, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { n } of sorted) {
    const full = path.join(root, n);
    if (phaseZipContainsAllCompletionReports(root, full)) return full;
  }
  throw new Error(
    "[resolveReviewZip] 現有 phase-*.zip 皆不含目前 docs 所列之 BATCH*-COMPLETION-REPORT；請執行 node script/create-review-zip.mjs",
  );
}
