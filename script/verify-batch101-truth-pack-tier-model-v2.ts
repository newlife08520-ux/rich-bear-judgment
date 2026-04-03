import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const rel of [
  "docs/active/TRUTH-PACK-TIER-MODEL-v2.md",
  "docs/active/STAGING-CAPTURE-CONTRACT.md",
  "docs/active/PROD-SANITIZATION-CONTRACT.md",
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error("[FAIL] missing", rel);
    process.exit(1);
  }
}
const tier = fs.readFileSync(path.join(root, "docs", "active", "TRUTH-PACK-TIER-MODEL-v2.md"), "utf-8");
for (const lab of ["Tier A", "Tier B", "Tier C", "Tier D"]) {
  if (!tier.includes(lab)) {
    console.error("[FAIL] tier model should define", lab);
    process.exit(1);
  }
}
console.log("[PASS] verify-batch101 truth-pack-tier-model-v2");
