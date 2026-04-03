/**
 * Phase 5 驗收：AI 輸出與規則引擎對齊 — 評分/通過由系統計算，Data Context 含建議動作，避免 AI 與系統 action 打架。
 * 執行：npx tsx script/verify-phase5-rule-alignment.ts
 */
import {
  STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION,
  buildDataContextSection,
} from "../server/rich-bear-prompt-assembly";

function main() {
  if (!STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("由系統依 score 與門檻計算") && !STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("由系統")) {
    console.error("未通過：Output Schema 應註明由系統依 score/門檻計算，非 AI 輸出 passed");
    process.exit(1);
  }
  if (STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("passed") && !STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("請勿輸出 passed")) {
    console.error("未通過：應明確請勿輸出 passed，由系統計算");
    process.exit(1);
  }
  const ctx = buildDataContextSection({ suggestedAction: "降 15%", reason: "測試" });
  if (!ctx.includes("建議動作") || !ctx.includes("降 15%")) {
    console.error("未通過：buildDataContextSection 應包含建議動作，供 AI 對齊");
    process.exit(1);
  }
  if (!STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("score") || !STRUCTURED_JUDGMENT_OUTPUT_INSTRUCTION.includes("problemType")) {
    console.error("未通過：Output Schema 應含 score、problemType 等與規則引擎對齊欄位");
    process.exit(1);
  }
  console.log("通過：Output 由系統計算、Data Context 含建議動作，規則對齊已就緒。");
  process.exit(0);
}

main();
