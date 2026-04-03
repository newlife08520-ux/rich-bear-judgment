# 審判官（AI 判讀）

## 1. 頁面用途

- **在做什麼**：與「總監」對話進行素材／頁面／廣告／漏斗判讀；並列決策卡、目標節奏、證據側欄；可匯出報告、從對話建立任務（經執行門檻）。
- **主要給誰**：老闆、投手、營運。
- **情境**：深度問答、搭配營運工作台看決策卡、開證據對照附件。

## 2. 進入方式

- **route**：`/judgment`。
- **從哪裡來**：側欄主導航「審判官」、設定「角色工作流」連結、其他頁深連結**待確認**。
- **前置條件**：登入；`useJudgmentWorkbench` 載入 session **待確認** URL 參數行為。

## 3. 首屏必須看到的內容

1. **`JudgmentHeader`**：`SidebarTrigger`、歷史開合、`text-page-title`「審判官」、副標、`聚焦審判`／`營運工作台` 切換、`📄 匯出裁決報告`、`新對話`、證據開合。
2. **主內容頂**（`focus`）：`JudgmentFocusStrip` 或（`operator`）決策卡＋目標節奏區。
3. **`judgment-focus-evidence-hint`** 列：證據連結＋附件／帳戶數（focus 模式）。
4. **空狀態** `JudgmentEmptyState` 或訊息串氣泡。
5. **底部** `JudgmentComposer`：工作流 chips、快速提示、輸入框、送出。

## 4. 區塊排列順序

- **頂**：Header 全寬。
- **中左（可選）**：`JudgmentHistorySidebar`（當 `historyOpen`）。
- **中主欄**：`ScrollArea` 內訊息與摺疊 `進階：決策卡與目標節奏`（focus 模式）。
- **中右（可選）**：`JudgmentEvidencePanel`（`rightPanelOpen`）。
- **底**：`JudgmentComposer` sticky。
- **全域 Dialog**：`ExecutionGateDialog`（建立任務確認）。

**布局**：三欄可變（歷史｜主｜證據）；最小為單欄＋composer。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- **送出對話**（composer 內送出，與 `canSubmit` 綁定）—**主互動**。
- **`新對話`**：開新 session—**與送出同級重要**。

### B. 次按鈕（Secondary）

- **`聚焦審判`／`營運工作台`**：`secondary`/`ghost` 切換。
- **`📄 匯出裁決報告`**：`outline`。
- **工作流**、**快速提示** chips：`outline`/`default`。

### C. 危險按鈕（Danger）

- **`ExecutionGateDialog` 確認建立任務**：勾選＋確認—實質寫入稽核與任務。

### D. 輔助按鈕（Utility）

- **收合／展開歷史**、**證據**側欄；**進階**摺疊 trigger；**證據側欄**文字連結。

## 6. 篩選 / 控制元件

- **工作流** `workflow` 多 chip；**附件** file input；無全頁日期。
- **history 搜尋**於側欄**待確認** prop 名。

## 7. 狀態資訊 / badge / warning

- **載入中**：`Loader2`（有 `sessionIdFromUrl` 時）。
- **送出中**：「總監審視中…」氣泡。
- **`submitError`**：**待確認** composer 顯示方式—**不可靜默**。

## 8. 可收合但不能消失的區塊

- **`進階：決策卡與目標節奏`** 摺疊可關，但 trigger 與內容不可刪。
- **證據面板**可關，但開關與 hint 列不可刪。
- **ExecutionGate** 流程不可略過為單鍵。

## 9. 此頁最不能被 AI 誤改的地方

- Header 模式切換與標題；composer 固定底部；gate 與勾選文案；focus strip 的結論一句。

## 10. Stitch 用摘要

審判官是可變三欄的對話＋決策工作台：首屏一定要看到標題列的模式切換、匯出與新對話，以及主區的結論條或決策卡。底部 composer 是主迴圈，不可改成浮動過小或消失。證據與進階決策卡可摺疊但入口要留。建立任務必須經對話框勾選確認。視覺優化應提升可讀與層次，而非把警告與 gate 變優雅但難找。

（約 240 字）
