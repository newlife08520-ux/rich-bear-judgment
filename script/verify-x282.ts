import * as fs from "fs";
import * as path from "path";
const prod = fs.readFileSync(
  path.join(process.cwd(), "client", "src", "pages", "products", "widgets", "ProductsBattleCard.tsx"),
  "utf8"
);
if (!prod.includes("goal-pacing-observation-line")) process.exit(1);
console.log("[verify:batch28_2:observation-window-precedence] OK");
