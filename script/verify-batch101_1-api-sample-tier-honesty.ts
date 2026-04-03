import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "docs", "API-SAMPLE-PAYLOADS.md");
if (!fs.existsSync(p)) {
  console.error("[FAIL] missing docs/API-SAMPLE-PAYLOADS.md");
  process.exit(1);
}
const t = fs.readFileSync(p, "utf-8");
if (!t.includes("Tier") && !t.includes("truth")) {
  console.error("[FAIL] API samples should state truth tier / honesty");
  process.exit(1);
}
console.log("[PASS] verify-batch101_1 api-sample-tier-honesty");
