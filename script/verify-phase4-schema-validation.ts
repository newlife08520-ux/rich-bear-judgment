/**
 * Phase 4 驗收：Schema-based runtime validation — 合法 JSON+合法 schema 通過；錯型別/缺欄位/非法 JSON 走 fallback。
 */
import { parseGeminiResponseForTest, parseContentJudgmentResponseForTest } from "../server/gemini";
import type { JudgmentType } from "../shared/schema";

function main() {
  const type: JudgmentType = "creative";

  // 1. 合法 JSON + 合法 schema -> 通過，非 fallback
  const validJudgment = parseGeminiResponseForTest(
    JSON.stringify({
      summary: { score: 85, grade: "A", verdict: "OK", topIssues: [], priorityActions: [], recommendation: "scale", recommendationNote: "" },
      detail: { type: "creative", reasoning: "x", executionSuggestions: [] },
    }),
    type
  );
  if (validJudgment.isFallback) {
    console.error("未通過：合法 JSON + 合法 schema 應通過，不應為 fallback");
    process.exit(1);
  }
  if (validJudgment.summary.score !== 85) {
    console.error("未通過：通過時應回傳正確 score");
    process.exit(1);
  }

  const validContent = parseContentJudgmentResponseForTest(
    JSON.stringify({
      oneLineVerdict: "OK",
      keyPoints: [],
      fullAnalysis: [],
      nextActions: [],
      followUpSuggestions: [],
    })
  );
  if (validContent.oneLineVerdict !== "OK") {
    console.error("未通過：合法 Content 應回傳正確 oneLineVerdict");
    process.exit(1);
  }

  // 2. 合法 JSON + 錯型別（detail.reasoning 為 number）-> schema 驗證失敗，走 fallback
  const wrongType = parseGeminiResponseForTest(
    JSON.stringify({
      summary: { score: 85, grade: "A", verdict: "x", topIssues: [], priorityActions: [], recommendation: "scale", recommendationNote: "" },
      detail: { reasoning: 123, executionSuggestions: [] },
    }),
    type
  );
  if (!wrongType.isFallback) {
    console.error("未通過：detail.reasoning 為 number 時應 schema 失敗走 fallback");
    process.exit(1);
  }

  // 3. 合法 JSON + 缺必要欄位（detail.executionSuggestions 非陣列）-> schema 失敗走 fallback
  const badDetail = parseGeminiResponseForTest(
    JSON.stringify({
      summary: { score: 80, grade: "A", verdict: "x", topIssues: [], priorityActions: [], recommendation: "hold", recommendationNote: "" },
      detail: { reasoning: "x", executionSuggestions: "not-array" },
    }),
    type
  );
  if (!badDetail.isFallback) {
    console.error("未通過：detail.executionSuggestions 非陣列應 schema 失敗走 fallback");
    process.exit(1);
  }

  // 4. 非法 JSON / 雜訊 -> 走 fallback
  const invalidJson = parseGeminiResponseForTest("not json at all", type);
  if (!invalidJson.isFallback) {
    console.error("未通過：非法 JSON 應走 fallback");
    process.exit(1);
  }

  const invalidContent = parseContentJudgmentResponseForTest("not json");
  if (!invalidContent.oneLineVerdict.includes("解析失敗") && !invalidContent.oneLineVerdict.includes("預設結果")) {
    console.error("未通過：Content 非法 JSON 應回傳 fallback 文案");
    process.exit(1);
  }

  console.log("通過：Phase 4 schema-based runtime validation 驗證完成。");
  process.exit(0);
}

main();
