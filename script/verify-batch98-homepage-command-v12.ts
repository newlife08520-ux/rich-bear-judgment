import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dash = fs.readFileSync(path.join(root, "client", "src", "pages", "dashboard.tsx"), "utf-8");
const v12 = fs.readFileSync(
  path.join(root, "client", "src", "pages", "dashboard", "widgets", "HomepageCommandPanelV12.tsx"),
  "utf-8",
);
for (const id of [
  "section-homepage-first-screen-command-v12",
  "rail-homepage-top3-command-v12",
  "banner-partial-first-screen-actionability-v12",
]) {
  if (!dash.includes(id) && !v12.includes(id)) {
    console.error("[FAIL] missing testid", id);
    process.exit(1);
  }
}
const design = path.join(root, "docs", "active", "HOMEPAGE-COMMAND-PANEL-V12-DESIGN.md");
if (!fs.existsSync(design)) {
  console.error("[FAIL] missing HOMEPAGE-COMMAND-PANEL-V12-DESIGN.md");
  process.exit(1);
}
console.log("[PASS] verify-batch98 homepage-command-v12");
