import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const man = JSON.parse(fs.readFileSync(path.join(root, "docs", "REVIEW-PACK-MANIFEST.json"), "utf-8")) as {
  phaseLabel?: string;
  completionReports?: string[];
};
const contents = JSON.parse(fs.readFileSync(path.join(root, "docs", "REVIEW-PACK-CONTENTS.json"), "utf-8")) as {
  phaseLabel?: string;
  completionReports?: string[];
};
if (man.phaseLabel && contents.phaseLabel && man.phaseLabel !== contents.phaseLabel) {
  console.error("[FAIL] MANIFEST phaseLabel 與 CONTENTS 不一致");
  process.exit(1);
}
const genPath = path.join(root, "script", "lib", "review-pack-generator-version.mjs");
const gv = fs.readFileSync(genPath, "utf-8");
const m = gv.match(/REVIEW_PACK_GENERATOR_VERSION\s*=\s*"([^"]+)"/);
if (!m || !m[1]) {
  console.error("[FAIL] 無法解析 REVIEW_PACK_GENERATOR_VERSION");
  process.exit(1);
}
if (!contents.completionReports?.length) {
  console.error("[FAIL] REVIEW-PACK-CONTENTS completionReports 為空");
  process.exit(1);
}
console.log("[PASS] verify-batch97_2 manifest-contents-docs-alignment generator=", m[1]);
