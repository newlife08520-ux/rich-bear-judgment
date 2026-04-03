# 角色視角補充 Overlay（Prompt 設定）

## 1. 頁面用途

- 編輯 Boss／投手／創意三視角的「補充偏好與輸出規則」overlay 草稿；檢視已發布摘要；儲存草稿、發布、回滾；Boss 視角含部分結構化欄位（摘要順序、長度、先顯示風險等）。**不**取代設定中心「AI 主腦」整包 System Prompt。
- 主要給管理者。

## 2. 進入方式

- route：`/settings/prompts`。
- 設定中心連結「角色視角 Overlay」。

## 3. 首屏必須看到的內容

1. 標題「角色視角補充 Overlay」。
2. 頁頂說明：三視角、不覆蓋核心人格、不含 Hidden Calibration。
3. Tabs：三模式切換（MODES）。
4. 第一卡「目前使用中的 Overlay」、摘要 pre、回滾按鈕。

## 4. 區塊排列順序

- Header → 說明 → TabsList → 各 TabsContent：已發布卡 → 草稿卡（Textarea 或結構化 grid）→ overlayError → 底部儲存草稿與發布。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 「發布」：帶 Upload 圖示，與儲存草稿並列。

### B. 次按鈕（Secondary）

- 「儲存草稿」；已發布卡內「回滾」outline。

### C. 危險按鈕（Danger）

- 回滾屬版本操作。

### D. 輔助按鈕（Utility）

- Lock 圖示等若有；SidebarTrigger。

## 6. 篩選 / 控制元件

- mode tab；Boss 下多個 Select 與 input（summaryOrder、summaryLength、showRiskFirst 等，見原始碼）。

## 7. 狀態資訊 / badge / warning

- overlayError 紅底區；已發布摘要前三行 pre。

## 8. 可收合但不能消失的區塊

- 三視角 tab；禁止填寫人格／Hidden Calibration 的說明；發布與草稿分離。

## 9. 此頁最不能被 AI 誤改的地方

- 與 `/settings` System Prompt 的區隔文案；發布／回滾；**待確認**：程式碼中「發布者」列與 `publishedAt` 顯示疑似不一致，需工程確認後再給 Stitch 定稿。

## 10. Stitch 用摘要

此頁是三 tab 的 overlay 版本化編輯器：首屏說明與 tab 讓使用者知道不是改整包人格。每視角先有已發布摘要與回滾，再編草稿。主 CTA 是發布。設計勿與設定中心 AI 主腦合併成單頁；禁止事項文案要留。顯示 bug 修復前請沿用現有區塊結構不改語意。

（約 190 字）
