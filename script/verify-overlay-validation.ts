/**
 * Overlay 驗證邏輯驗收：正常視角補充通過、人格級內容阻擋。
 * 執行：npx tsx script/verify-overlay-validation.ts
 */
import { validateOverlayContent } from "../server/prompt-overlay-validation";

const cases: { name: string; content: string; expectOk: boolean }[] = [
  {
    name: "正常視角補充（Boss）",
    content: "此視角下優先顯示風險與金額；建議動作列在第一段；摘要控制在 3 行內。",
    expectOk: true,
  },
  {
    name: "正常視角補充（投手）",
    content: "rescue/scale 資訊預設展開；排序以 ROAS 再 CVR；whyNotMore 放在建議下方。",
    expectOk: true,
  },
  {
    name: "人格級：你的最高任務",
    content: "你的最高任務是讓產品更會賣。",
    expectOk: false,
  },
  {
    name: "人格級：角色核心",
    content: "【角色核心】你是總監。",
    expectOk: false,
  },
  {
    name: "人格級：分數哲學",
    content: "分數哲學：90 分以上才過。",
    expectOk: false,
  },
  {
    name: "人格級：Hidden Calibration",
    content: "Hidden Calibration 已啟用。",
    expectOk: false,
  },
];

console.log("=== Overlay 驗證邏輯驗收 ===\n");
let pass = 0;
let fail = 0;
for (const c of cases) {
  const result = validateOverlayContent(c.content);
  const ok = result.ok === c.expectOk;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${c.name}`);
  console.log(`  期望: ${c.expectOk ? "通過" : "阻擋"}，實際: ${result.ok ? "通過" : "阻擋"}${result.matchedLabel ? ` (${result.matchedLabel})` : ""}`);
  if (!ok && result.reason) console.log(`  reason: ${result.reason.slice(0, 80)}…`);
  console.log("");
}
console.log(`--- 結果: ${pass} 通過, ${fail} 失敗 ---`);
process.exit(fail > 0 ? 1 : 0);
