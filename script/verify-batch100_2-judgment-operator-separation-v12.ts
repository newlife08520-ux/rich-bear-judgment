import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "client", "src", "pages", "judgment.tsx"), "utf-8");
if (!page.includes("judgment-operator-workbench-v8") || !page.includes("layoutMode === \"focus\"")) {
  console.error("[FAIL] judgment page should separate operator vs focus");
  process.exit(1);
}
console.log("[PASS] verify-batch100_2 judgment-operator-separation-v12");
