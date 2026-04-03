/**
 * Phase 3 驗收：Event loop 讓步已落地在大型迴圈（refresh-pipeline 使用 yieldToEventLoop / setImmediate）。
 * 執行：npx tsx script/verify-phase3-event-loop-yield.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pipelinePath = path.join(root, "server", "refresh-pipeline.ts");
const yieldPath = path.join(root, "server", "lib", "event-loop-yield.ts");

function main() {
  const yieldContent = fs.readFileSync(yieldPath, "utf-8");
  if (!yieldContent.includes("setImmediate") || !yieldContent.includes("yieldToEventLoop")) {
    console.error("未通過：server/lib/event-loop-yield.ts 應匯出 yieldToEventLoop 並使用 setImmediate");
    process.exit(1);
  }
  const pipelineContent = fs.readFileSync(pipelinePath, "utf-8");
  if (!pipelineContent.includes("yieldToEventLoop")) {
    console.error("未通過：refresh-pipeline 應呼叫 yieldToEventLoop");
    process.exit(1);
  }
  if (!pipelineContent.includes("yieldToEventLoop") || pipelineContent.indexOf("await yieldToEventLoop()") === -1) {
    const hasAwaitYield = /await\s+yieldToEventLoop\s*\(\s*\)/.test(pipelineContent);
    if (!hasAwaitYield) {
      console.error("未通過：refresh-pipeline 應在迴圈內 await yieldToEventLoop()");
      process.exit(1);
    }
  }
  console.log("通過：Event loop 讓步已落地於 refresh-pipeline 大型迴圈。");
  process.exit(0);
}

main();
