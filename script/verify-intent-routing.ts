/**
 * 意圖路由驗收：與 server/routes.ts 的 inferWorkflow 邏輯一致，驗證 5 個 case。
 * 執行：npx tsx script/verify-intent-routing.ts
 */
type Workflow = "clarify" | "create" | "audit" | "strategy" | "task";

function inferWorkflow(content: string): Workflow {
  const t = content.trim().toLowerCase();
  if (/審|判|打分|幫我看|評估|評分|看這支|看這個|幫我審|判讀/.test(t)) return "audit";
  if (/寫|產出|架構|腳本|文案|幫我做|生出|延伸方向|銷售頁|短影音/.test(t)) return "create";
  if (/哪個該拉|該停|分配|優先|策略|取捨|拉停/.test(t)) return "strategy";
  if (/拆任務|轉任務|任務列表|分給團隊|任務拆/.test(t)) return "task";
  return "clarify";
}

function isInputSufficientForAudit(content: string, hasAttachments: boolean): boolean {
  const hasUrl = /https?:\/\/\S+/i.test(content.trim());
  const sufficientLength = content.trim().length >= 30;
  return hasAttachments || hasUrl || sufficientLength;
}

const cases: { name: string; input: string; expect: Workflow; expectSufficient?: boolean }[] = [
  { name: "1. 銷售頁架構 → create", input: "幫我寫這個產品的銷售頁架構", expect: "create" },
  { name: "2. 嚴格審這頁 → audit", input: "幫我嚴格審這頁", expect: "audit" },
  { name: "3. 哪個該停哪個該拉 → strategy", input: "這幾支素材哪個該停哪個該拉", expect: "strategy" },
  { name: "4. 有點卡不知道從哪開始 → clarify", input: "我現在有點卡，這頁不知道從哪開始", expect: "clarify" },
  { name: "5a. 模糊輸入 幫我審（不足）→ audit + 應追問", input: "幫我審", expect: "audit", expectSufficient: false },
  { name: "5b. 幫我審 + 長文案（充足）→ audit + 可審", input: "幫我審這篇：我們是專業的團隊提供優質服務與高CP值方案歡迎洽詢", expect: "audit", expectSufficient: true },
];

console.log("=== 意圖路由驗收 ===\n");
let pass = 0;
let fail = 0;
for (const c of cases) {
  const got = inferWorkflow(c.input);
  const ok = got === c.expect;
  const auditSufficient = c.expect === "audit" ? isInputSufficientForAudit(c.input, false) : undefined;
  const sufficientOk = c.expectSufficient === undefined || (auditSufficient === c.expectSufficient);
  const allOk = ok && sufficientOk;
  if (allOk) pass++;
  else fail++;
  console.log(`${allOk ? "✓" : "✗"} ${c.name}`);
  console.log(`  輸入: "${c.input.slice(0, 50)}${c.input.length > 50 ? "…" : ""}"`);
  console.log(`  推論: ${got}${!ok ? ` (期望 ${c.expect})` : ""}`);
  if (c.expect === "audit" && c.expectSufficient !== undefined) {
    console.log(`  輸入充足: ${auditSufficient} (期望 ${c.expectSufficient})${!sufficientOk ? " ← 不符" : ""}`);
  }
  console.log("");
}
console.log(`--- 結果: ${pass} 通過, ${fail} 失敗 ---`);
process.exit(fail > 0 ? 1 : 0);
