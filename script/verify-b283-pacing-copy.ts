import * as fs from "fs";
import * as path from "path";
const eng = fs.readFileSync(path.join(process.cwd(), "shared", "goal-pacing-engine.ts"), "utf8");
if (!eng.includes("為何不該再動")) process.exit(1);
if (!eng.includes("為何不放鬆目標")) process.exit(1);
console.log("[verify:batch28_3:goal-pacing-copy-quality] OK");
