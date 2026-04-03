import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const rel of [
  "docs/active/DOCS-CANONICALITY-RULES.md",
  "docs/active/DOCS-CANONICALITY-MIGRATION.md",
  "docs/archive/README.md",
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error("[FAIL] missing", rel);
    process.exit(1);
  }
}
console.log("[PASS] verify-batch97 docs-canonical-boundaries");
