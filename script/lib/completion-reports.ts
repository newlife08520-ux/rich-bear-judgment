import * as fs from "fs";
import * as path from "path";

/** 與 completion-reports.mjs 對齊（含 CANONICALITY-FIX 等中綴） */
const REPORT_RE =
  /^BATCH[\d._-]+(?:-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?-COMPLETION-REPORT\.md$/i;

function walkCompletionReports(docsDir: string, relPrefix: string, out: string[]): void {
  let entries: fs.Dirent[];
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

/** docs/ 與 _agent_batch_archives/docs/ 之 BATCH*-COMPLETION-REPORT.md */
export function listCompletionReportRelPaths(root: string): string[] {
  const out: string[] = [];
  for (const base of [
    path.join(root, "docs"),
    path.join(root, "_agent_batch_archives", "docs"),
  ]) {
    if (!fs.existsSync(base)) continue;
    const inner: string[] = [];
    walkCompletionReports(base, "", inner);
    for (const r of inner) out.push(`docs/${r.replace(/\\/g, "/")}`);
  }
  return [...new Set(out)].sort();
}
