# Partial vs No Data：營運劇本

## 定義（與 state machine 對齊）

- **has_data**：決策所需維度已達門檻，可進入正常敘事與操作。
- **partial_data**：部分維度晚到、缺漏或僅單平台；**必須高可見**，必要時鎖定或降級高風險操作。
- **no_data**：在該 scope／時間窗內確認無有效量（非「還在載入」）。
- **no_sync**：尚未完成同步或無有效 batch；與「沒花費」區分。

## 各 surface 一致原則

- Dashboard／商品／FB／CI／審判應引用同一套 `data-truth-state-machine` 與首頁 truth 欄位，避免一頁說「可判」另一頁說「無資料」。
- `partial_data` 時：顯示 badge／banner；若產品規格要求，對「一鍵執行類」按鈕降級或二次確認。

## 不變更

- 不改寫 visibility-policy、dormant gems、pareto、goal／pacing 的核心 if／else 商業語意；僅統一 **如何向使用者描述資料狀態**。

## 驗證

- `verify:commercial-readiness:data-truth`、`partial-no-data-separation`、`cross-surface-truth-consistency`（granular）。
