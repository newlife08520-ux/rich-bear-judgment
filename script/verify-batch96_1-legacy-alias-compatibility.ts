import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as { scripts: Record<string, string> };
const s = pkg.scripts;
if (!s["verify:wave:legacy-umbrella"]?.includes("verify:full")) {
  console.error("[FAIL] verify:wave:legacy-umbrella should chain verify:full");
  process.exit(1);
}
if (s["verify:final"] !== "npm run verify:release-candidate") {
  console.error("[FAIL] verify:final must equal verify:release-candidate");
  process.exit(1);
}
console.log("[PASS] verify-batch96_1 legacy-alias-compatibility");
