# External Meta Change Policy v2

**Canonical v1**：`docs/active/EXTERNAL-META-CHANGE-POLICY.md`。

## v2 補充

- **Stale AI recommendation**：偵測到漂移時，AI／規則產出視為 **可能 stale**；高風險動作前應 **更新資料**（refresh）再執行。
- **與 pacing**：使用者可「已讀並校準今日調整節奏」— 與 `resetAdjustCountsForUserToday` 對齊（見 v1）。
- **未偵測**：不保證後台無變更；僅代表與**上次快照**比對之一致性。
