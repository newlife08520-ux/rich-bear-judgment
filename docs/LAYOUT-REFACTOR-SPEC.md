# 全站 Layout 重構規格（純前端、不動 API）

## 0) 介面問題整理

### (A) 版面／滾動
- **根因**：`.content-readable`（max-width: 900px + mx-auto）套在戰情、FB 分析、GA4 等資料頁 → 2K/4K 下內容窄置中、左右大片空白。
- **巢狀捲軸**：`main` 為 `overflow-hidden`，各頁內層再包 `flex-1 overflow-auto` → 出現「內層捲軸」或雙捲軸體感。

### (B) 資訊架構
- 待後續：KPI 一行可掃、今日待辦置頂、全部資料表格化（本階段僅做版面與捲動）。

### (C) 元件可用性
- 待後續：權限頁 MultiSelect、表格 DataTable、判讀三欄（本階段不變更）。

### (D) 視覺層級
- 待後續：入口與空狀態優化（本階段不變更）。

---

## 1) 根因對應

| 現象 | 根因 | 解法 |
|------|------|------|
| 左右大片空白、不能橫向 | `.content-readable` 限制 900px + 置中 | 資料頁改 `page-container-fluid`（全寬） |
| 畫面被切掉 | 表格外層無 overflow-x + min-w | `.table-scroll-container` 強化，表格給 min-width |
| 雙捲軸／內層捲軸 | main 不捲、頁內再包全高 overflow | main 改為唯一捲軸，頁面只做 padding 不包 overflow |

---

## 2) 實作清單

### Step 1：寬度策略（本檔對應）
- [x] 新增 utility：`.page-container-fluid`（w-full max-w-none px-4 md:px-6）
- [x] 新增 utility：`.page-container-reading`（max-w-3xl mx-auto px-4，給長文/表單）
- [x] 戰情、FB 帳號分析、GA4 分析：移除 `content-readable`，改為 `page-container-fluid`
- [x] 判讀／設定／歷史等閱讀型：維持或改用 `page-container-reading`（不強制全寬）

### Step 2：單一主捲軸
- [x] App.tsx：`main` 改為 `flex-1 min-h-0 overflow-auto`（主捲軸在 main）
- [x] Dashboard / FB Ads / GA4 / Settings / History / Publish 等：內容區移除 `flex-1 overflow-auto`，改為僅 padding + 內容流動，由 main 捲動

### Step 3：表格橫向
- [x] `.table-scroll-container` 確保 `overflow-x-auto`，內層 table 可設 `min-w-[...]`
- [ ]（可選）Shift+滾輪橫向、拖曳橫向 hook

---

## 3) 影響範圍

- **CSS**：`index.css` 新增 class，保留 `content-readable` 供閱讀型頁面選用。
- **App.tsx**：main 的 class 變更。
- **頁面**：dashboard.tsx, fb-ads.tsx, ga4-analysis.tsx, settings.tsx, history.tsx, team-settings.tsx, publish-placeholder.tsx, publish-history-placeholder.tsx（僅 class 與外層結構，不動資料/API）。judgment.tsx、assets.tsx 維持原佈局（判讀為窄容器對話；素材為雙欄右側捲動）。

---

## 4) 回歸測試步驟

1. **寬度**：瀏覽器寬度 2560px、1920px 開啟戰情總覽、FB 帳號分析、GA4 分析 → 主內容應全寬，無「窄窄置中＋左側大空白」。
2. **捲軸**：同頁面從頂捲到底 → 僅一個主捲軸（main），無內外雙捲軸打架。
3. **表格**：FB 分析／戰情表格欄位多時 → 可橫向捲動看完整欄位，不被切掉。
4. **判讀／設定／歷史**：版面正常、不因移除 content-readable 而撐破；閱讀型頁面可維持合理 max-width。

---

## 5) 完成狀態與對照

- **完成狀態**：Step 1、Step 2、Step 3（表格容器）已完成。
- **截圖／錄影**：建議在 1920、2560 各截一張戰情與 FB 分析，與重構前對照。
