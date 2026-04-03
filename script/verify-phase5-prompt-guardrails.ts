/**
 * Phase 5 驗收：Prompt 護欄與 context 壓縮（長度上限、截斷）。
 * 執行：npx tsx script/verify-phase5-prompt-guardrails.ts
 */
import {
  getAssembledSystemPrompt,
  MAX_CUSTOM_MAIN_PROMPT_CHARS,
  MAX_DATA_CONTEXT_CHARS,
  STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION,
} from "../server/rich-bear-prompt-assembly";

function main() {
  if (MAX_CUSTOM_MAIN_PROMPT_CHARS <= 0 || MAX_DATA_CONTEXT_CHARS <= 0) {
    console.error("未通過：MAX_CUSTOM_MAIN_PROMPT_CHARS / MAX_DATA_CONTEXT_CHARS 應為正數");
    process.exit(1);
  }
  const sentinel = "___PHASE5_SENTINEL_END___";
  const longOverlay = "x".repeat(MAX_CUSTOM_MAIN_PROMPT_CHARS + 1000) + sentinel;
  const out1 = getAssembledSystemPrompt({
    uiMode: "boss",
    customMainPrompt: longOverlay,
    workflow: "clarify",
  });
  if (!out1.includes("已截斷")) {
    console.error("未通過：customMainPrompt 過長時應被截斷並含「已截斷」標記");
    process.exit(1);
  }
  if (out1.includes(sentinel)) {
    console.error("未通過：截斷後不應含長字串尾端標記（表示有截斷）");
    process.exit(1);
  }
  const longData = "y".repeat(MAX_DATA_CONTEXT_CHARS + 1000) + sentinel;
  const out2 = getAssembledSystemPrompt({
    uiMode: "boss",
    dataContext: longData,
    workflow: "audit",
    judgmentType: "creative",
  });
  if (!out2.includes("已截斷")) {
    console.error("未通過：dataContext 過長時應被截斷並含「已截斷」標記");
    process.exit(1);
  }
  if (out2.includes(sentinel)) {
    console.error("未通過：dataContext 截斷後不應含長字串尾端標記");
    process.exit(1);
  }
  if (!STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("score") || !STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("problemType")) {
    console.error("未通過：STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION 應含 score、problemType 等與規則引擎對齊欄位");
    process.exit(1);
  }
  console.log("通過：Phase 5 Prompt 護欄與 context 壓縮行為正確。");
  process.exit(0);
}

main();
