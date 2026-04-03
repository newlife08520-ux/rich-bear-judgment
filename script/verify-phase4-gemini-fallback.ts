/**
 * Phase 4 驗收：Gemini 解析改為結構化 + fallback，parse 失敗必回 fallback 物件（不 crash）。
 * 執行：npx tsx script/verify-phase4-gemini-fallback.ts
 */
import { parseGeminiResponseForTest } from "../server/gemini";
import type { JudgmentType } from "../shared/schema";

function main() {
  const type: JudgmentType = "creative";
  const bad = parseGeminiResponseForTest("not valid json at all", type);
  if (!bad.isFallback) {
    console.error("未通過：無效 JSON 應回傳 isFallback=true");
    process.exit(1);
  }
  if (!bad.summary.verdict || (!bad.summary.verdict.includes("解析失敗") && !bad.summary.verdict.includes("預設結果"))) {
    console.error("未通過：fallback summary.verdict 應含「解析失敗」或「預設結果」");
    process.exit(1);
  }
  if (bad.detail.type !== type) {
    console.error("未通過：fallback detail.type 應與輸入 type 一致");
    process.exit(1);
  }
  const validJson = parseGeminiResponseForTest(JSON.stringify({
    summary: { score: 85, grade: "A", verdict: "OK", topIssues: [], priorityActions: [], recommendation: "scale", recommendationNote: "" },
    detail: { type: "creative", reasoning: "x", executionSuggestions: [] },
  }), type);
  if (validJson.isFallback) {
    console.error("未通過：有效 JSON 不應為 fallback");
    process.exit(1);
  }
  if (validJson.summary.score !== 85 || validJson.summary.grade !== "A") {
    console.error("未通過：有效 JSON 應解析出 score=85, grade=A");
    process.exit(1);
  }
  console.log("通過：Phase 4 結構化解析與 fallback 行為正確。");
  process.exit(0);
}

main();
