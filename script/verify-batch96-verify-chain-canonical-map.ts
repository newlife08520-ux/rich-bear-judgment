import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = path.join(root, "docs", "active", "VERIFY-CHAIN-CANONICAL-MAP.md");
if (!fs.existsSync(doc)) {
  console.error("[FAIL] missing docs/active/VERIFY-CHAIN-CANONICAL-MAP.md");
  process.exit(1);
}
const t = fs.readFileSync(doc, "utf-8");
for (const needle of ["verify:ui-core", "verify:full", "verify:product-restructure", "verify:release-candidate"]) {
  if (!t.includes(needle)) {
    console.error("[FAIL] map should mention", needle);
    process.exit(1);
  }
}
console.log("[PASS] verify-batch96 verify-chain-canonical-map");
