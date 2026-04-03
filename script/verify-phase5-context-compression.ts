/**
 * Phase 5 驗收：context 壓縮真正有效（dataContext / customMainPrompt 超過上限即截斷，且不進入尾段）。
 * 執行：npx tsx script/verify-phase5-context-compression.ts
 */
import { getAssembledSystemPrompt, MAX_DATA_CONTEXT_CHARS, MAX_CUSTOM_MAIN_PROMPT_CHARS } from "../server/rich-bear-prompt-assembly";

function main() {
  const sentinel = "___CTX_SENTINEL_END___";
  const longData = "z".repeat(MAX_DATA_CONTEXT_CHARS + 2000) + sentinel;
  const out = getAssembledSystemPrompt({
    uiMode: "boss",
    dataContext: longData,
    workflow: "audit",
    judgmentType: "creative",
  });
  if (!out.includes("已截斷")) {
    console.error("未通過：過長 dataContext 應被截斷並標記");
    process.exit(1);
  }
  if (out.includes(sentinel)) {
    console.error("未通過：截斷後不應含尾段標記，表示壓縮有效");
    process.exit(1);
  }
  const overlayLong = "w".repeat(MAX_CUSTOM_MAIN_PROMPT_CHARS + 1000) + sentinel;
  const out2 = getAssembledSystemPrompt({ uiMode: "boss", customMainPrompt: overlayLong, workflow: "clarify" });
  if (out2.includes(sentinel)) {
    console.error("未通過：過長 customMainPrompt 截斷後不應含尾段");
    process.exit(1);
  }
  console.log("通過：context 壓縮有效，過長內容已截斷且尾段未進入 prompt。");
  process.exit(0);
}

main();
