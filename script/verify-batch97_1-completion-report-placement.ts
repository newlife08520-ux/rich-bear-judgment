import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_RE =
  /^BATCH[\d._-]+(?:-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?-COMPLETION-REPORT\.md$/i;

function walk(dir: string, bad: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const base = ent.name.toLowerCase();
      if (base === "node_modules" || base === ".git") continue;
      walk(abs, bad);
    } else if (REPORT_RE.test(ent.name)) {
      const rel = path.relative(path.join(root, "docs"), abs).replace(/\\/g, "/");
      if (!rel.startsWith("active/") && !rel.startsWith("archive/")) {
        bad.push(`docs/${rel}`);
      }
    }
  }
}

const bad: string[] = [];
walk(path.join(root, "docs"), bad);
if (bad.length) {
  console.error("[FAIL] BATCH*-COMPLETION-REPORT 僅允許在 docs/active 或 docs/archive，發現:", bad.join(", "));
  process.exit(1);
}
const active = path.join(root, "docs", "active");
const found = fs.existsSync(active)
  ? fs.readdirSync(active).filter((f) => REPORT_RE.test(f))
  : [];
if (found.length === 0) {
  console.error("[FAIL] docs/active 應至少有一份 BATCH*-COMPLETION-REPORT.md");
  process.exit(1);
}
console.log("[PASS] verify-batch97_1 completion-report-placement:", found.length, "in active");
