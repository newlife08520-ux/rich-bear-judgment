# Staging Capture Contract v2

**Canonical v1**：`docs/active/STAGING-CAPTURE-CONTRACT.md`。

## v2 必填欄位形狀（placeholder 亦同）

- `truthTier`: `"Tier C"`
- `captureStatus`: `"complete" | "pending"`
- `provenance`: `{ "environment": "staging", "capturedAt"?: string, "tool"?: string }`

## 命令契約（建議）

- 擷取腳本／手動步驟應可重跑；輸出路徑與 `SCREENSHOT-TO-DATA-MAP.md` 交叉引用。
- **無真 staging 時**：僅允許 placeholder + 上述欄位，**禁止**偽造為完成態。
