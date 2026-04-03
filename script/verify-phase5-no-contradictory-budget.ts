/**
 * Phase 5 驗收：系統判定降 15% 時，AI 不可寫成加碼；後端 alignment helper 生效。
 */
import { validateJudgmentAgainstSystemAction } from "../server/lib/judgment-alignment";

function main() {
  // 1. 系統判定 decrease 15%，mock AI 回「加碼」-> 必須對齊，輸出不得保留加碼
  const r1 = validateJudgmentAgainstSystemAction("降 15%", 15, "素材潛力高，建議加碼");
  if (!r1.violated) {
    console.error("未通過：系統降 15%、AI 加碼 應標記 violated");
    process.exit(1);
  }
  if (/加碼|擴|增/.test(r1.alignedNextAction)) {
    console.error("未通過：對齊後不得含加碼/擴/增，alignedNextAction=" + r1.alignedNextAction);
    process.exit(1);
  }

  // 2. 系統判定 hold，mock AI 回「大幅降碼」
  const r2 = validateJudgmentAgainstSystemAction("維持", undefined, "建議大幅降碼觀察");
  if (!r2.violated) {
    console.error("未通過：系統維持、AI 降碼 應標記 violated");
    process.exit(1);
  }

  // 3. 系統判定 increase，mock AI 回「先停投」
  const r3 = validateJudgmentAgainstSystemAction("可加碼", undefined, "建議先停投再評估");
  if (!r3.violated) {
    console.error("未通過：系統加碼、AI 停投 應標記 violated");
    process.exit(1);
  }
  if (/停|止/.test(r3.alignedNextAction)) {
    console.error("未通過：對齊後不得含停/止，alignedNextAction=" + r3.alignedNextAction);
    process.exit(1);
  }

  // 4. 系統判定降 15%，AI 回「依數據建議降 15%」-> 不矛盾
  const r4 = validateJudgmentAgainstSystemAction("降 15%", 15, "依數據建議降 15%");
  if (r4.violated) {
    console.error("未通過：一致時不應標記 violated");
    process.exit(1);
  }
  if (r4.alignedNextAction !== "依數據建議降 15%") {
    console.error("未通過：一致時應保留原 AI 文案");
    process.exit(1);
  }

  console.log("通過：Phase 5 無矛盾預算（deterministic alignment）驗證完成。");
  process.exit(0);
}

main();
