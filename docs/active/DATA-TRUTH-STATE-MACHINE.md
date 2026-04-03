# 資料真值狀態機

## 枚舉（程式單一來源）

見 `shared/data-truth-state-machine.ts`：

- `has_data`
- `partial_data`
- `no_data`
- `no_sync`

## 對照儀表板

- `partial_decision`（首頁語意）映射為 `partial_data`（`normalizeDashboardDataStatus`）。

## UI 原則

- **partial** 與 **no data** 不得混用文案。
- 部分操作在 `no_sync`／`no_data` 時應鎖定或降權（各頁自行實作）。

## Verify

- `npm run verify:commercial-readiness` 檢查模組與本文件並存。
