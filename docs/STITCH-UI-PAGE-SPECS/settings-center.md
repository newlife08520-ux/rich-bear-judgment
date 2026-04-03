# 設定中心

## 1. 頁面用途

- 總覽連到各管理子頁；表單含偏好、進階開關；分 tab 管理 API 綁定（GA4、FB Token、AI Key）、AI 主腦 System Prompt、Pipeline 偵錯；底部「儲存所有設定」與儲存後導覽卡。
- 主要給管理者與需連線的全角色。

## 2. 進入方式

- route：`/settings`。
- 側欄更多「設定中心」。

## 3. 首屏必須看到的內容

1. SidebarTrigger、標題「設定中心」。
2. SettingsOverviewSection：管理工具與 AI 作戰設定連結群、角色工作流三欄建議。
3. SettingsPreferencesCard（偏好與進階）。
4. Tabs：API 綁定、AI 主腦、Pipeline 狀態。

## 4. 區塊排列順序

- Header → page-container-reading → Overview → form → PreferencesCard → Tabs 內容 → 表單外底部儲存鈕 → 條件 post-save guide Card。

## 5. 按鈕盤點

### A. 主按鈕（Primary CTA）

- 「儲存所有設定」submit；導覽卡內「立即同步帳號」與「前往首頁更新資料」。

### B. 次按鈕（Secondary）

- API tab：顯示／隱藏 FB Token、AI Key（Eye 圖示）；匯入／匯出 System Prompt；各 SettingsApiConnectionSection 內測試類按鈕（待確認）。

### C. 危險按鈕（Danger）

- 無顯式 destructive；誤改 API 屬營運風險，需視覺區隔敏感欄位。

### D. 輔助按鈕（Utility）

- 「知道了」關閉導覽卡；Overview 內多個 outline 導航 Link。

## 6. 篩選 / 控制元件

- 三主 tab；Preferences 內多 control（見 SettingsPreferencesCard）。

## 7. 狀態資訊 / badge / warning

- 文案：API 變更 onBlur 自動存與「儲存所有設定」並存（**易混淆，待產品確認**）；CURRENT_AI_MODEL 顯示；Pipeline 偵錯 tab。

## 8. 可收合但不能消失的區塊

- Overview 導航連結到門檻、Overlay、映射、團隊；API 三區隔與同步帳號區塊 id sync-account-block（導覽 scroll 用）。

## 9. 此頁最不能被 AI 誤改的地方

- 敏感輸入與顯示切換；System Prompt 大 textarea；儲存後導覽三步驟。

## 10. Stitch 用摘要

設定中心是閱讀寬容器：先 Overview 導流，再偏好，再三分 tab。首屏要讓人找到子設定入口與連線欄位。主 CTA 是儲存所有設定，但 API 欄位另有 blur 儲存行為需在畫面上交代清楚。視覺上敏感欄位應分組與標示，勿與一般偏好混在同一視覺權重。

（約 200 字）
