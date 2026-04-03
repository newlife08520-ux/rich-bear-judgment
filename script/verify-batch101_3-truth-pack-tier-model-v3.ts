import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const v3 = path.join(root, "docs", "active", "TRUTH-PACK-TIER-MODEL-v3.md");
if (!fs.existsSync(v3)) {
  console.error("[FAIL] missing docs/active/TRUTH-PACK-TIER-MODEL-v3.md");
  process.exit(1);
}
const body = fs.readFileSync(v3, "utf-8");
for (const needle of [
  "Tier A",
  "illustrative",
  "Tier B",
  "seeded",
  "Tier C",
  "staging-sanitized",
  "Tier D",
  "prod-sanitized",
  "TRUTH-PACK-TIER-MODEL-v2",
]) {
  if (!body.includes(needle)) {
    console.error("[FAIL] TRUTH-PACK-TIER-MODEL-v3.md must mention:", needle);
    process.exit(1);
  }
}
console.log("[PASS] verify-batch101_3 truth-pack-tier-model-v3");
