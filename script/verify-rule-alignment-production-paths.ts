/**
 * 驗收：所有對外輸出 structuredJudgment 的 path 皆在輸出前呼叫 validateJudgmentAgainstSystemAction。
 * 依 cursor_acceptance_gap_closure 清單 Step 4.2。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const routesPath = path.join(root, "server/routes.ts");

function main() {
  const content = fs.readFileSync(routesPath, "utf-8");
  const lines = content.split("\n");

  if (!content.includes("validateJudgmentAgainstSystemAction")) {
    console.error("[FAIL] routes.ts must import and use validateJudgmentAgainstSystemAction");
    process.exit(1);
  }
  if (!content.includes("structuredJudgment")) {
    console.log("[OK] no structuredJudgment output in routes (nothing to align)");
    process.exit(0);
  }

  const outputPattern = /structuredJudgment|assistantMessage.*structuredJudgment/;
  const alignmentPattern = /validateJudgmentAgainstSystemAction/;
  let inHandler = false;
  let handlerStart = 0;
  let lastAlignmentLine = -1;
  let lastOutputLine = -1;
  let handlersWithOutput: number[] = [];
  let handlersWithAlignment: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/app\.(get|post|put|patch|delete)\s*\(/.test(line)) {
      inHandler = true;
      handlerStart = i;
      lastAlignmentLine = -1;
      lastOutputLine = -1;
    }
    if (inHandler) {
      if (alignmentPattern.test(line)) lastAlignmentLine = i;
      if (outputPattern.test(line) && (line.includes("res.json") || line.includes("assistantMessage") || line.includes("structuredJudgment"))) {
        lastOutputLine = i;
      }
      if (line.trim().startsWith("});") && lastOutputLine >= handlerStart) {
        handlersWithOutput.push(handlerStart);
        if (lastAlignmentLine >= handlerStart) handlersWithAlignment.push(handlerStart);
        inHandler = false;
      }
    }
  }

  const missing = handlersWithOutput.filter((s) => !handlersWithAlignment.includes(s));
  if (missing.length > 0) {
    console.error("[FAIL] Handlers that output structuredJudgment must call validateJudgmentAgainstSystemAction before response. Handler starts at lines:", missing.map((s) => s + 1));
    process.exit(1);
  }
  console.log("[OK] All production paths that output structuredJudgment call validateJudgmentAgainstSystemAction before response");
  process.exit(0);
}

main();
