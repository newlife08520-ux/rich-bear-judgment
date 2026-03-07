# 審判頁面規格

## 頁面結構
左右分欄：左側 40% 輸入面板，右側 60% 報告顯示面板。

## 左側輸入面板

### Step 1: 類型選擇 (TypeSelector)
4 張類型卡片，點擊切換：
- 素材審判 (creative) - 紫色
- 銷售頁審判 (landing_page) - 藍色
- FB/Meta 廣告審判 (fb_ads) - 琥珀色
- GA4 漏斗審判 (ga4_funnel) - 翠綠色

### Step 2: 分析模式選擇 (AnalysisModeSelector)
shadcn Select 下拉選單，選項來自 `analysisModes[type]`。每個類型有不同的選項集。

### Step 3: 動態表單 (DynamicForm)
依類型不同顯示不同欄位：

#### Creative 素材
- 檔案上傳區 (拖放或點擊，支援圖片/影片/PDF)
- 投放情境下拉 (Select, 選項來自 `creativeScenarios`: 冷流量/再行銷/官網導購/品牌曝光)
- 分析模式下拉 (AnalysisModeSelector)
- 補充說明 (Textarea)

#### Landing Page 銷售頁
- 目標網址 (Input, URL)
- 廣告文案 (Textarea, 用於比對廣告承諾 vs 頁面承接)
- 分析模式下拉 (AnalysisModeSelector)
- 補充說明 (Textarea)

#### FB Ads 廣告
- 帳號選擇器 (Select, 從 /api/accounts)
- 日期範圍 (Select: 最近7天/14天/30天/自訂)
- 搜尋 (Input, 搜尋素材名稱)
- 分析模式下拉 (AnalysisModeSelector)
- 補充說明 (Textarea)

#### GA4 漏斗
- GA4 資源 (Select)
- 日期範圍 (Select: 最近7天/14天/30天/自訂)
- 搜尋 (Input)
- 分析模式下拉 (AnalysisModeSelector)
- 補充說明 (Textarea)

### Step 4: 送審按鈕
- disabled 條件：未選類型 or 未選分析模式 or 正在送審
- 送審時顯示 loading spinner
- 成功後右側面板切換到報告顯示

## 右側報告面板

### 空狀態
- 類型已選：顯示類型描述、範例輸出卡片、「上次分析」快捷按鈕
- 類型未選：顯示「尚未送審」提示

### 報告顯示 (Tabs: 決策摘要/深度分析)

#### 決策摘要 Tab
1. 分數圓圈 + 等級 Badge + 一句話判決
2. 重大問題 (TopIssues, 紅色卡片)
3. 先做這 3 件事 (PriorityActions, 綠色卡片)
   - 每項顯示：編號 + 動作 + 原因 + 影響等級 badge
4. 建議動作 Badge (launch/scale/hold/stop/fix_first)

#### 深度分析 Tab
1. 5 維雷達圖 (Recharts RadarChart)
2. 5 維度診斷卡片 (score + analysis)
3. AI 判斷邏輯 (reasoning)
4. 模組專屬區塊（依類型不同）
5. 執行建議列表

## 表單提交 API
```
POST /api/judgment/start
Body: {
  type: JudgmentType,
  objective: string,      // 分析模式 ID (向下相容)
  analysisMode: string,   // 分析模式 ID
  scenario: string,       // 投放情境 (creative only)
  notes: string,
  url: string,
  adCopy: string,
  metricsData: Record<string, any>,
  funnelData: Record<string, any>,
  searchQuery: string,
  dateRange: string,
  accountId: string
}
```

## 目前狀態
- [x] TypeSelector (4 類型卡片)
- [x] AnalysisModeSelector (下拉取代 chips)
- [x] DynamicForm (4 種表單)
- [x] 報告顯示 (Summary + Detail tabs)
- [x] 先做這 3 件事 (含 reason)
- [x] 雷達圖
- [x] 空狀態右側面板
- [ ] 上傳後的檔案預覽優化
- [ ] 報告 PDF 匯出

## 相關檔案
- `client/src/pages/judgment.tsx` - 整個審判頁面 (~1340 行)
- `shared/schema.ts` - analysisModes, creativeScenarios, JudgmentInput, JudgmentReport
- `server/routes.ts` - POST /api/judgment/start
- `server/prompt-builder.ts` - buildJudgmentUserPrompt
