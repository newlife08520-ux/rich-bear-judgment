import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const rel of ["docs/SCREENSHOT-TO-DATA-MAP.md", "docs/UI-TRUTH-MAPPING.md"]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error("[FAIL] missing", rel);
    process.exit(1);
  }
}
const map = fs.readFileSync(path.join(root, "docs", "SCREENSHOT-TO-DATA-MAP.md"), "utf-8");
if (!map.includes("Tier") && !map.includes("tier")) {
  console.error("[FAIL] screenshot map should reference truth tier");
  process.exit(1);
}
console.log("[PASS] verify-batch101_2 screenshot-data-tier-consistency-v2");
