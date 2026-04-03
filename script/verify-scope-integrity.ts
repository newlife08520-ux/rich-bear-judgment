/**
 * 驗收 scope 完整性：buildScopeKey 納入 custom、storage per-user、AppScopeProvider 傳入 userId。
 * 依 cursor_acceptance_gap_closure 清單 Step 3.1。
 */
import { buildScopeKey } from "../shared/schema";

function main() {
  let passed = 0;
  let failed = 0;

  // 1. buildScopeKey 納入 customStart/customEnd 時，key 應含 custom 區間
  const keyCustom = buildScopeKey("u1", [], [], "custom", "2025-01-01", "2025-01-07");
  if (keyCustom.includes("custom:2025-01-01~2025-01-07")) {
    passed++;
    console.log("[OK] buildScopeKey includes custom range in key");
  } else {
    failed++;
    console.error("[FAIL] buildScopeKey should include custom:start~end, got:", keyCustom);
  }

  const keyPreset = buildScopeKey("u1", [], [], "7");
  if (keyPreset === "u1::all::7" && !keyPreset.includes("custom")) {
    passed++;
    console.log("[OK] buildScopeKey preset-only key unchanged");
  } else {
    failed++;
    console.error("[FAIL] buildScopeKey preset 7 should be u1::all::7, got:", keyPreset);
  }

  // 2. 不同 userId 應產生不同 key（per-user 語意）
  const keyU1 = buildScopeKey("u1", [], [], "7");
  const keyU2 = buildScopeKey("u2", [], [], "7");
  if (keyU1 !== keyU2) {
    passed++;
    console.log("[OK] scope key differs by userId");
  } else {
    failed++;
    console.error("[FAIL] scope key should differ by userId");
  }

  // 3. 靜態檢查提示：AppScopeProvider userId 與 storage key per-user 需由人工或 grep 確認
  console.log("[INFO] AppScopeProvider userId: check client App.tsx passes user.id to AppScopeProvider");
  console.log("[INFO] Storage per-user: check use-app-scope uses storageKey(userId) = app-scope:${userId}");

  console.log("\n[verify-scope-integrity] passed:", passed, "failed:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

main();
