import * as fs from "fs";
import * as path from "path";
const r = path.join(process.cwd());
const ub = fs.readFileSync(path.join(r, "server", "modules", "pareto", "pareto-unified-builder.ts"), "utf8");
const routes = fs.readFileSync(path.join(r, "server", "routes", "pareto-routes.ts"), "utf8");
const pe = fs.readFileSync(path.join(r, "shared", "pareto-engine.ts"), "utf8");
if (!ub.includes("company") || !pe.includes("assembleParetoEngineV2")) process.exit(1);
if (!routes.includes("engine-v2")) process.exit(1);
console.log("[verify:batch29:pareto-multilevel] OK");
