import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ci = fs.readFileSync(
  path.join(root, "client", "src", "pages", "creative-intelligence", "workbench", "CreativeIntelligenceWorkbench.tsx"),
  "utf-8",
);
if (!ci.includes("ci-dormant-operational-v7")) {
  console.error("[FAIL] CI workbench should expose ci-dormant-operational-v7");
  process.exit(1);
}
console.log("[PASS] verify-batch99_2 ci-dormant-operational-v7");
