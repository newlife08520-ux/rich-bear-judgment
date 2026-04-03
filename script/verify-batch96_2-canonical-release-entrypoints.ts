import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as { scripts: Record<string, string> };
const s = pkg.scripts;
const prep = s["create-review-zip:verified:inner:prep"] ?? "";
if (!prep.includes("verify:release-candidate") || !prep.includes("capture-verify-full-outputs")) {
  console.error("[FAIL] inner:prep must include release-candidate and capture-verify-full-outputs");
  process.exit(1);
}
const post = s["create-review-zip:verified:inner:postZip"] ?? "";
if (!post.includes("verify:review-zip-hygiene")) {
  console.error("[FAIL] inner:postZip must include verify:review-zip-hygiene");
  process.exit(1);
}
if (!s["create-review-zip:verified"]?.includes("wrap-create-review-zip-verified")) {
  console.error("[FAIL] create-review-zip:verified must run wrap-create-review-zip-verified");
  process.exit(1);
}
console.log("[PASS] verify-batch96_2 canonical-release-entrypoints");
