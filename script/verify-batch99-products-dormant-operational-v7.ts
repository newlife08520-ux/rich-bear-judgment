import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wf = fs.readFileSync(path.join(root, "client", "src", "lib", "workbench-filter-context.tsx"), "utf-8");
if (!wf.includes("dormant_priority")) {
  console.error("[FAIL] workbench filter should support dormant sort");
  process.exit(1);
}
const card = fs.readFileSync(
  path.join(root, "client", "src", "pages", "products", "widgets", "ProductsBattleCard.tsx"),
  "utf-8",
);
if (!card.includes("products-battle-card-dormant-hint")) {
  console.error("[FAIL] ProductsBattleCard dormant hint");
  process.exit(1);
}
const doc = path.join(root, "docs", "active", "DORMANT-GEM-OPERATIONALIZATION-V7.md");
if (!fs.existsSync(doc)) {
  console.error("[FAIL] missing DORMANT-GEM-OPERATIONALIZATION-V7.md");
  process.exit(1);
}
console.log("[PASS] verify-batch99 products-dormant-operational-v7");
