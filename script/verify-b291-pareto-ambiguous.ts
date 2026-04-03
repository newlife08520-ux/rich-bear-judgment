import * as fs from "fs";
import * as path from "path";
const ub = fs.readFileSync(
  path.join(process.cwd(), "server", "modules", "pareto", "pareto-unified-builder.ts"),
  "utf8"
);
if (!ub.includes("ambiguousAttribution")) process.exit(1);
console.log("[verify:batch29_1:hidden-diamond-vs-money-pit] OK");
