/**
 * 審查包：docs/（含 active/archive 子目錄）內所有 BATCH*-COMPLETION-REPORT.md
 */
import fs from "fs";
import path from "path";

/** 含 BATCH12.7-CANONICALITY-FIX-COMPLETION-REPORT 等 optional 中綴 */
const REPORT_RE =
  /^BATCH[\d._-]+(?:-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?-COMPLETION-REPORT\.md$/i;

function walkCompletionReports(docsDir, relPrefix, out) {
  let entries;
  try {
    entries = fs.readdirSync(docsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    const abs = path.join(docsDir, ent.name);
    if (ent.isDirectory()) {
      walkCompletionReports(abs, rel, out);
    } else if (REPORT_RE.test(ent.name)) {
      out.push(rel.replace(/\\/g, "/"));
    }
  }
}

function collectReportsUnderDocsRoot(root, docsRootAbs) {
  if (!fs.existsSync(docsRootAbs)) return [];
  const inner = [];
  walkCompletionReports(docsRootAbs, "", inner);
  return inner.map((r) => `docs/${r.replace(/\\/g, "/")}`);
}

/** 含 docs/ 與本機封存 _agent_batch_archives/docs/（同上目錄結構，不進 Git） */
export function listCompletionReportPaths(root) {
  const primary = collectReportsUnderDocsRoot(root, path.join(root, "docs"));
  const archived = collectReportsUnderDocsRoot(
    root,
    path.join(root, "_agent_batch_archives", "docs"),
  );
  return [...new Set([...primary, ...archived])].sort();
}

export function parseBatchVersion(name) {
  const m = name.match(/^BATCH([\d._-]+)(?:-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?-COMPLETION-REPORT\.md$/i);
  return m ? m[1].replace(/_/g, ".") : null;
}

export function cmpBatchVersion(a, b) {
  const pa = a.split(/[._-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[._-]/).map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function detectLatestPhaseLabel(root) {
  const paths = listCompletionReportPaths(root);
  const versions = paths
    .map((p) => path.basename(p))
    .map(parseBatchVersion)
    .filter(Boolean)
    .sort(cmpBatchVersion);
  const latest = versions.at(-1);
  if (!latest) return "phase-review-pack";
  const slug = latest.replace(/\./g, "_");
  return `phase-batch${slug}-complete`;
}
