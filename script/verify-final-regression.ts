/**
 * Final 回歸：依序執行 Phase 2～5 驗收，任一失敗即 exit 1。
 * 執行：npx tsx script/verify-final-regression.ts
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const scripts = [
  "script/verify-phase2-acceptance.ts",
  "script/verify-phase2-lifecycle.ts",
  "script/verify-phase2-failure-no-pollute.ts",
  "script/verify-phase3-concurrency.ts",
  "script/verify-phase3-retry-integration.ts",
  "script/verify-phase3-no-memory-storage.ts",
  "script/verify-phase3-upload-cleanup.ts",
  "script/verify-phase3-workbench-bulk.ts",
  "script/verify-phase3-retry-wrapped.ts",
  "script/verify-phase3-event-loop-yield.ts",
  "script/verify-phase4-gemini-fallback.ts",
  "script/verify-phase4-schema-validation.ts",
  "script/verify-phase5-prompt-guardrails.ts",
  "script/verify-phase5-context-compression.ts",
  "script/verify-phase5-rule-alignment.ts",
  "script/verify-phase5-no-contradictory-budget.ts",
  "script/verify-phase5-production-alignment-path.ts",
  "script/verify-scope-integrity.ts",
  "script/verify-dashboard-scope-unification.ts",
  "script/verify-no-mock-in-live-decision.ts",
  "script/verify-ai-contract-unification.ts",
  "script/verify-rule-alignment-production-paths.ts",
];

function main() {
  for (const s of scripts) {
    const name = path.basename(s);
    console.log(`[verify:final] Running ${name}...`);
    try {
      execSync(`npx tsx ${s}`, { cwd: root, stdio: "inherit" });
    } catch (e) {
      console.error(`[verify:final] ${name} failed`);
      process.exit(1);
    }
  }
  console.log("[verify:final] All regression checks passed.");
  process.exit(0);
}

main();
