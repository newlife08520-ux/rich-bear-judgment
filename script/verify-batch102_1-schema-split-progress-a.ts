import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = path.join(root, "shared", "schema", "recommendation-level.ts");
if (!fs.existsSync(mod)) {
  console.error("[FAIL] missing shared/schema/recommendation-level.ts");
  process.exit(1);
}
const schema = fs.readFileSync(path.join(root, "shared", "schema.ts"), "utf-8");
if (!schema.includes("./schema/recommendation-level")) {
  console.error("[FAIL] schema.ts should re-export recommendation-level module");
  process.exit(1);
}
if (!schema.includes("./schema/publish-draft-contract")) {
  console.error("[FAIL] schema.ts should re-export publish-draft-contract module");
  process.exit(1);
}
const doc = path.join(root, "docs", "active", "SCHEMA-SPLIT-PROGRESS-A.md");
if (!fs.existsSync(doc)) {
  console.error("[FAIL] missing SCHEMA-SPLIT-PROGRESS-A.md");
  process.exit(1);
}
console.log("[PASS] verify-batch102_1 schema-split-progress-a");
