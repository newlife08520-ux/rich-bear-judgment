# FB/Meta 廣告模組規格

## 模組定位
分析 Meta 廣告帳號數據，做出素材排名、找出被埋沒的高潛力素材、標記該停的素材、給出預算調整建議。

## 分析模式 (analysisModes.fb_ads)

| ID | Label | 說明 |
|----|-------|------|
| account_overview | 帳號總覽判讀 | 整體帳號健康度 |
| best_creative | 找出表現最好素材 | 按 ROAS/CTR 排名 |
| stop_creative | 找出該停掉素材 | 疲勞/虧損素材 |
| budget_adjust | 預算調整建議 | 預算分配優化 |
| buried_check | 素材遺漏/未放大量檢查 | 找被低估的素材 |

## 資料型別

### FbAdCreative
```typescript
{
  id: string;
  name: string;           // 素材名稱
  thumbnail: string;      // 縮圖 URL
  campaign: string;       // 行銷活動名稱
  adSet: string;          // 廣告組名稱
  spend: number;          // 花費 (NT$)
  ctr: number;            // 點擊率 (%)
  cpc: number;            // 每次點擊成本
  roas: number;           // 廣告投資報酬率
  frequency: number;      // 頻率
  conversions: number;    // 轉換次數
  aiLabel: string;        // AI 標籤 (主力候選/高潛力未放大/已疲勞/先停再說/會騙點但不會轉/再行銷限定/冷流量不適合/建議重做前3秒)
  aiComment: string;      // AI 評語
  status: "active" | "paused" | "ended";
}
```

### FbAccountOverview
```typescript
{
  spend: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number;
  creativeCount: number;       // 總素材數
  activeCount: number;         // 活躍素材數
  stopSuggestionCount: number; // 建議停止數
  highPotentialCount: number;  // 高潛力數
}
```

### FbAIDirectorSummary
```typescript
{
  verdict: string;       // 總監一句話判決
  topAction: string;     // 最重要的下一步
  biggestWaste: string;  // 最大浪費
  bestDirection: string; // 最佳方向
}
```

## API 端點

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/fb-ads/overview?accountId=X | 帳號總覽數據 |
| GET | /api/fb-ads/creatives?accountId=X&search=Q | 素材列表（可搜尋） |
| GET | /api/fb-ads/director-summary?accountId=X | AI 總監摘要 |
| GET | /api/fb-ads/buried-gems?accountId=X | 高潛力未放大素材 |
| GET | /api/fb-ads/stop-list?accountId=X | 建議停止素材 |

## AI 標籤分類邏輯

| aiLabel | 條件 | 建議動作 |
|---------|------|---------|
| 主力候選 | CTR+ROAS 均優於帳號均值 | 持續投放 |
| 高潛力未放大 | 數據好但花費低 | 加預算測試 |
| 已疲勞 | Frequency 高 + CTR 下滑 | 準備替換 |
| 先停再說 | CTR 極低 + ROAS<1 | 立即停止 |
| 會騙點但不會轉 | CTR 高但 ROAS 低 | 檢查著陸頁 |
| 再行銷限定 | 再行銷好但 Frequency 高 | 短期使用 |
| 冷流量不適合 | 缺鉤子，適合暖流量 | 轉為再行銷素材 |
| 建議重做前3秒 | 開場無吸引力 | 重製開場 |

## Mock 資料
- 10 筆素材記錄（storage.ts 內 getFbAdCreatives）
- 涵蓋各種 aiLabel 類型
- 帳號總花費 NT$ 212,100，整體 ROAS 3.4

## 審判頁面表單 (fb_ads 類型)
- 帳號選擇器 (Select)
- 日期範圍選擇器 (Select)
- 搜尋輸入框 (Input)
- 分析模式下拉選單 (Select, 從 analysisModes.fb_ads)
- 補充說明 (Textarea)

## 報告結構 (Mode C 輸出)
- diagnosis: creativeHealth, audienceMatch, fatigue, budgetEfficiency, scalability
- extras: metricsAnalysis[], fatigueSignals[], audienceInsights[], scalingAdvice

## 目前狀態
- [x] Schema 型別定義
- [x] Mock 資料 (10 筆素材)
- [x] API 端點 (5 個)
- [x] 審判頁表單 (分析模式下拉)
- [x] 審判報告渲染 (Summary + Detail)
- [ ] 獨立 FB 廣告戰情室頁面（素材排名表格、buried gems 卡片、stop list 卡片、總監摘要）
- [ ] 素材卡片視覺（縮圖、指標、AI 標籤 badge）
- [ ] 篩選/排序功能

## 相關檔案
- `shared/schema.ts` - FbAdCreative, FbAccountOverview, FbAIDirectorSummary
- `server/storage.ts` - getFbAdCreatives, getFbAccountOverview, getFbAIDirectorSummary, getFbBuriedGems, getFbStopList
- `server/routes.ts` - /api/fb-ads/* 端點
- `client/src/pages/judgment.tsx` - fb_ads 表單區塊
