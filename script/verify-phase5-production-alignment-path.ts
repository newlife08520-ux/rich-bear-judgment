/**
 * Phase 5 驗收：從 AI 回應到對外輸出，production path 上確實發生對齊保護。
 * 模擬 POST /api/content-judgment/chat 中 structuredJudgment 組裝流程：
 * parseStructuredJudgmentFromResponse(assistantText) -> 若有 systemAction 則 validateJudgmentAgainstSystemAction -> 違反時覆寫 nextAction。
 * 驗證：最終對外輸出不會保留與系統 action 相反的 budget 建議。
 */
import { parseStructuredJudgmentFromResponse } from "../server/parse-structured-judgment";
import { validateJudgmentAgainstSystemAction } from "../server/lib/judgment-alignment";

const MOCK_AI_RESPONSE_CONTRADICTORY = `
結論：素材表現佳，可考慮擴量。
\`\`\`json
{
  "summary": "素材潛力高，建議加碼",
  "nextAction": "建議加碼 20% 測試",
  "problemType": "創意",
  "score": 75
}
\`\`\`
`;

const MOCK_AI_RESPONSE_STOP = `
\`\`\`json
{
  "summary": "先停投觀察",
  "nextAction": "建議先停投再評估",
  "score": 40
}
\`\`\`
`;

function main() {
  // 1. Fixture：系統判定降 15%，AI 回覆含「建議加碼」
  const parsed1 = parseStructuredJudgmentFromResponse(MOCK_AI_RESPONSE_CONTRADICTORY);
  if (!parsed1?.nextAction) {
    console.error("未通過：fixture 應解析出 nextAction");
    process.exit(1);
  }
  if (!/加碼|擴/.test(parsed1.nextAction)) {
    console.error("未通過：mock AI 應含加碼/擴以模擬矛盾");
    process.exit(1);
  }
  const aligned1 = validateJudgmentAgainstSystemAction("降 15%", 15, parsed1.nextAction);
  if (!aligned1.violated) {
    console.error("未通過：系統降 15%、AI 加碼應標記 violated");
    process.exit(1);
  }
  const finalOutput1 = aligned1.violated ? { ...parsed1, nextAction: aligned1.alignedNextAction } : parsed1;
  if (/加碼|擴|增/.test(finalOutput1.nextAction ?? "")) {
    console.error("未通過：對外輸出不得保留加碼/擴/增，nextAction=" + finalOutput1.nextAction);
    process.exit(1);
  }

  // 2. Fixture：系統判定加碼，AI 回覆「先停投」
  const parsed2 = parseStructuredJudgmentFromResponse(MOCK_AI_RESPONSE_STOP);
  if (!parsed2?.nextAction) {
    console.error("未通過：fixture 應解析出 nextAction");
    process.exit(1);
  }
  const aligned2 = validateJudgmentAgainstSystemAction("可加碼", undefined, parsed2.nextAction);
  if (!aligned2.violated) {
    console.error("未通過：系統加碼、AI 停投應標記 violated");
    process.exit(1);
  }
  const finalOutput2 = aligned2.violated ? { ...parsed2, nextAction: aligned2.alignedNextAction } : parsed2;
  if (/停|止/.test(finalOutput2.nextAction ?? "")) {
    console.error("未通過：對外輸出不得保留停/止，nextAction=" + finalOutput2.nextAction);
    process.exit(1);
  }

  // 3. 一致時不覆寫
  const parsed3 = parseStructuredJudgmentFromResponse(MOCK_AI_RESPONSE_CONTRADICTORY);
  const aligned3 = validateJudgmentAgainstSystemAction("可加碼", 20, parsed3!.nextAction);
  if (aligned3.violated) {
    console.error("未通過：系統加碼、AI 加碼不應違反");
    process.exit(1);
  }
  const finalOutput3 = aligned3.violated ? { ...parsed3, nextAction: aligned3.alignedNextAction } : parsed3;
  if (finalOutput3!.nextAction !== parsed3!.nextAction) {
    console.error("未通過：一致時應保留原 nextAction");
    process.exit(1);
  }

  console.log("通過：production path 對齊保護已驗證（parse -> align -> 對外輸出已覆寫）。");
  process.exit(0);
}

main();
